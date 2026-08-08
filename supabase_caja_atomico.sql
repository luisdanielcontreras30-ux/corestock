-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase, después de
-- supabase_caja.sql.
--
-- Antes, "no sacar más de lo que hay en caja" solo se validaba en el
-- navegador: dos "salidas" registradas al mismo tiempo (dos pestañas,
-- dos dispositivos) podían pasar ambas la validación del cliente y
-- dejar el saldo en negativo, porque cada una leía el saldo ANTES de
-- que la otra terminara de insertar su movimiento.
--
-- Esta función mueve el chequeo de saldo + la inserción del movimiento
-- a una sola transacción en la base de datos, y usa un advisory lock
-- por usuario para que dos llamadas simultáneas del mismo usuario se
-- ejecuten una detrás de otra en vez de en paralelo.

create or replace function registrar_movimiento_caja(
  p_tipo text,
  p_monto numeric,
  p_motivo text default null,
  p_monto_esperado numeric default null,
  p_diferencia numeric default null
)
returns caja_movimientos
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_saldo numeric;
  v_movimiento caja_movimientos;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if p_tipo not in ('apertura', 'entrada', 'salida', 'cierre') then
    raise exception 'Tipo de movimiento inválido';
  end if;

  if p_monto is null or p_monto < 0 then
    raise exception 'Monto inválido';
  end if;

  -- Serializa las llamadas concurrentes de este mismo usuario: mientras
  -- una tiene el lock, cualquier otra llamada de ese usuario espera a
  -- que termine (y su insert ya cuenta) antes de calcular su propio
  -- saldo, así que dos salidas simultáneas no pueden leer el mismo
  -- saldo "viejo" a la vez.
  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  if p_tipo = 'salida' then
    with sesiones as (
      select
        tipo,
        monto,
        sum(case when tipo = 'apertura' then 1 else 0 end)
          over (order by fecha, id) as sesion
      from caja_movimientos
      where user_id = v_user_id
    )
    select coalesce(sum(
      case
        when tipo = 'apertura' then monto
        when tipo = 'entrada' then monto
        when tipo = 'salida' then -monto
        else 0
      end
    ), 0)
    into v_saldo
    from sesiones
    where sesion = (select coalesce(max(sesion), 0) from sesiones);

    if p_monto > v_saldo then
      raise exception 'SALDO_INSUFICIENTE';
    end if;
  end if;

  insert into caja_movimientos (
    fecha, tipo, monto, motivo, monto_esperado, diferencia, user_id
  ) values (
    now(), p_tipo, p_monto, nullif(trim(p_motivo), ''), p_monto_esperado, p_diferencia, v_user_id
  )
  returning * into v_movimiento;

  return v_movimiento;
end;
$$;

grant execute on function registrar_movimiento_caja(text, numeric, text, numeric, numeric) to authenticated;
