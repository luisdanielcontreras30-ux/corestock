-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- CoreStock Offline First: agrega una columna "uuid" única a ventas y
-- caja_movimientos — es la llave de idempotencia para la
-- sincronización, NO reemplaza el id entero real de cada tabla (eso
-- rompería las relaciones con producto_id/cliente_id y todo lo demás
-- que ya depende de esos ids).
--
-- El id sigue siendo el autoincremental de siempre. El uuid lo genera
-- el navegador (crypto.randomUUID()) en el momento de la venta o el
-- movimiento de caja, ANTES de saber si hay conexión — así, si la
-- sincronización de una operación pendiente se reintenta dos veces
-- (por ejemplo porque la conexión se cortó justo después de que el
-- insert ya había tenido éxito, antes de que la respuesta llegara al
-- navegador), la segunda vez encuentra la fila existente por su uuid
-- y no la duplica.

alter table ventas add column if not exists uuid uuid unique;
alter table caja_movimientos add column if not exists uuid uuid unique;

-- registrar_movimiento_caja (de supabase_caja_atomico.sql) gana un
-- parámetro opcional p_uuid: si ya existe un movimiento con ese uuid,
-- devuelve la fila existente en vez de insertar otra vez — así un
-- reintento de sincronización (por ejemplo, la conexión se cae justo
-- después del insert, antes de que la respuesta llegue al navegador)
-- no duplica el movimiento de caja. Agregar un parámetro con default
-- al final es compatible con las llamadas existentes que no lo mandan.
create or replace function registrar_movimiento_caja(
  p_tipo text,
  p_monto numeric,
  p_motivo text default null,
  p_monto_esperado numeric default null,
  p_diferencia numeric default null,
  p_uuid uuid default null
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

  if p_uuid is not null then
    select * into v_movimiento
    from caja_movimientos
    where uuid = p_uuid and user_id = v_user_id;

    if found then
      return v_movimiento;
    end if;
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
    fecha, tipo, monto, motivo, monto_esperado, diferencia, user_id, uuid
  ) values (
    now(), p_tipo, p_monto, nullif(trim(p_motivo), ''), p_monto_esperado, p_diferencia, v_user_id, p_uuid
  )
  returning * into v_movimiento;

  return v_movimiento;
end;
$$;

grant execute on function registrar_movimiento_caja(text, numeric, text, numeric, numeric, uuid) to authenticated;
