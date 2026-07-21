-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase, DESPUÉS de
-- desplegar el código nuevo (o antes, ambos órdenes son seguros: cada
-- política nueva se agrega, ninguna reemplaza ni angosta el acceso que
-- ya tiene el dueño de la cuenta).
--
-- Contexto: hasta ahora, un miembro del equipo entraba compartiendo el
-- auth.uid() real del dueño (magic link generado por
-- entrar-como-miembro), así que ninguna política "auth.uid() = user_id"
-- podía distinguir un miembro de un dueño — los permisos (ver_ventas,
-- configuracion, etc.) solo existían en el navegador. Este archivo
-- asume que cada miembro ya tiene su propio auth_user_id real (ver el
-- código nuevo de app/api/miembros/entrar-como-miembro/route.ts) y
-- agrega las políticas que sí distinguen quién pregunta y qué permiso
-- tiene.

-- 1) Identidad propia por miembro.
alter table public.miembros_equipo
  add column if not exists auth_user_id uuid references auth.users(id);

create unique index if not exists miembros_equipo_auth_user_id_key
  on public.miembros_equipo (auth_user_id)
  where auth_user_id is not null;

-- 2) Funciones de apoyo. security definer + search_path fijo: tienen
-- que poder leer miembros_equipo sin importar si la propia RLS de esa
-- tabla (más abajo, solo visible con permiso "configuracion") le
-- permitiría o no a quien llama verla directamente — si no,  un
-- miembro sin "configuracion" nunca podría demostrar que es un
-- miembro activo, y quedaría bloqueado de todo.

create or replace function public.resolver_negocio_id(p_auth_uid uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select user_id from miembros_equipo
     where auth_user_id = p_auth_uid and activo = true
     limit 1),
    p_auth_uid
  );
$$;

create or replace function public.es_miembro_activo(p_negocio_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from miembros_equipo
    where user_id = p_negocio_id
      and auth_user_id = auth.uid()
      and activo = true
  );
$$;

create or replace function public.miembro_tiene_permiso(p_negocio_id uuid, p_permiso text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from miembros_equipo
    where user_id = p_negocio_id
      and auth_user_id = auth.uid()
      and activo = true
      and p_permiso = any(permisos)
  );
$$;

-- 3) miembros_equipo: administrar el equipo requiere el permiso
-- "configuracion". El update lleva una guarda extra: un miembro con
-- "configuracion" puede editar a CUALQUIER OTRO miembro (incluso
-- darle o quitarle "configuracion"), pero no puede editar su propia
-- fila por esta vía — si pudiera, "configuracion" equivaldría a poder
-- autoconcederse cualquier otro permiso.
drop policy if exists "miembros_equipo_miembro_select" on public.miembros_equipo;
create policy "miembros_equipo_miembro_select" on public.miembros_equipo
  for select
  using (public.miembro_tiene_permiso(user_id, 'configuracion'));

drop policy if exists "miembros_equipo_miembro_insert" on public.miembros_equipo;
create policy "miembros_equipo_miembro_insert" on public.miembros_equipo
  for insert
  with check (public.miembro_tiene_permiso(user_id, 'configuracion'));

drop policy if exists "miembros_equipo_miembro_delete" on public.miembros_equipo;
create policy "miembros_equipo_miembro_delete" on public.miembros_equipo
  for delete
  using (public.miembro_tiene_permiso(user_id, 'configuracion'));

drop policy if exists "miembros_equipo_miembro_update" on public.miembros_equipo;
create policy "miembros_equipo_miembro_update" on public.miembros_equipo
  for update
  using (public.miembro_tiene_permiso(user_id, 'configuracion'))
  with check (
    public.miembro_tiene_permiso(user_id, 'configuracion')
    and auth_user_id is distinct from (select auth.uid())
  );

-- 4) empresa_config: cualquier miembro activo puede leerla (moneda,
-- nombre del negocio, etc. — datos que casi toda pantalla necesita
-- mostrar), pero solo "configuracion" puede modificarla.
drop policy if exists "empresa_config_miembro_select" on public.empresa_config;
create policy "empresa_config_miembro_select" on public.empresa_config
  for select
  using (public.es_miembro_activo(user_id));

drop policy if exists "empresa_config_miembro_insert" on public.empresa_config;
create policy "empresa_config_miembro_insert" on public.empresa_config
  for insert
  with check (public.miembro_tiene_permiso(user_id, 'configuracion'));

drop policy if exists "empresa_config_miembro_update" on public.empresa_config;
create policy "empresa_config_miembro_update" on public.empresa_config
  for update
  using (public.miembro_tiene_permiso(user_id, 'configuracion'))
  with check (public.miembro_tiene_permiso(user_id, 'configuracion'));

drop policy if exists "empresa_config_miembro_delete" on public.empresa_config;
create policy "empresa_config_miembro_delete" on public.empresa_config
  for delete
  using (public.miembro_tiene_permiso(user_id, 'configuracion'));

-- 5) ventas: un permiso distinto por operación, calcado del tipo
-- Permiso de app/configuracion/types.ts.
drop policy if exists "ventas_miembro_select" on public.ventas;
create policy "ventas_miembro_select" on public.ventas
  for select
  using (public.miembro_tiene_permiso(user_id, 'ver_ventas'));

drop policy if exists "ventas_miembro_insert" on public.ventas;
create policy "ventas_miembro_insert" on public.ventas
  for insert
  with check (public.miembro_tiene_permiso(user_id, 'registrar_ventas'));

drop policy if exists "ventas_miembro_update" on public.ventas;
create policy "ventas_miembro_update" on public.ventas
  for update
  using (public.miembro_tiene_permiso(user_id, 'editar_ventas'))
  with check (public.miembro_tiene_permiso(user_id, 'editar_ventas'));

drop policy if exists "ventas_miembro_delete" on public.ventas;
create policy "ventas_miembro_delete" on public.ventas
  for delete
  using (public.miembro_tiene_permiso(user_id, 'eliminar_ventas'));

-- 6) productos: ver el catálogo queda abierto a cualquier miembro
-- activo (lo necesitan para vender); crear o eliminar un producto
-- requiere "gestionar_inventario". Nota: esto no oculta la columna
-- "costo" — ver_ganancias sigue siendo solo de interfaz, igual que
-- hoy, porque RLS protege filas, no columnas.
drop policy if exists "productos_miembro_select" on public.productos;
create policy "productos_miembro_select" on public.productos
  for select
  using (public.es_miembro_activo(user_id));

drop policy if exists "productos_miembro_insert" on public.productos;
create policy "productos_miembro_insert" on public.productos
  for insert
  with check (public.miembro_tiene_permiso(user_id, 'gestionar_inventario'));

-- El update queda con cualquier miembro activo, NO solo
-- "gestionar_inventario" — a diferencia de crear/eliminar un
-- producto, este UPDATE es el que usan como efecto secundario
-- ventas, compras, devoluciones, ajustes de stock, traspasos,
-- fabricación y cotizaciones para mover productos.stock (ninguna de
-- esas tablas exige gestionar_inventario para sí misma, quedaron con
-- acceso de cualquier miembro activo en la sección 7 de abajo). Con
-- el update exigiendo gestionar_inventario, un cajero podía registrar
-- la venta pero el descuento de stock quedaba bloqueado por RLS sin
-- avisar claramente por qué — ninguna venta se podía completar.
drop policy if exists "productos_miembro_update" on public.productos;
create policy "productos_miembro_update" on public.productos
  for update
  using (public.es_miembro_activo(user_id))
  with check (public.es_miembro_activo(user_id));

drop policy if exists "productos_miembro_delete" on public.productos;
create policy "productos_miembro_delete" on public.productos
  for delete
  using (public.miembro_tiene_permiso(user_id, 'gestionar_inventario'));

-- 7) El resto de las tablas del negocio no tienen todavía un permiso
-- puntual en la interfaz (ningún puede() las gatea hoy) — se les da
-- acceso completo a cualquier miembro activo, igual que el
-- comportamiento actual, para no quitarle a nadie algo que ya podía
-- hacer.
do $$
declare
  t text;
begin
  foreach t in array array[
    'clientes', 'proveedores', 'compras', 'caja_movimientos',
    'cotizaciones', 'facturas_globales', 'devoluciones', 'ajustes_stock',
    'materias_primas', 'recetas', 'producciones', 'promociones',
    'traspasos', 'stock_ubicaciones', 'ubicaciones', 'conciliaciones'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'drop policy if exists "%s_miembro_activo" on public.%I',
        t, t
      );
      execute format(
        'create policy "%s_miembro_activo" on public.%I for all using (public.es_miembro_activo(user_id)) with check (public.es_miembro_activo(user_id))',
        t, t
      );
    end if;
  end loop;
end $$;

-- 8) registrar_movimiento_caja (supabase_offline_sync.sql) calculaba
-- el saldo y armaba el candado de concurrencia con auth.uid()
-- directo, sin pasar por RLS — con identidad propia por miembro esto
-- rompería Caja por completo (saldo en cero, movimientos invisibles
-- para el negocio, y el candado ya no serializaría a dos miembros del
-- mismo negocio entre sí). Se reescribe para resolver primero a qué
-- negocio pertenece quien llama.
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
  v_auth_uid uuid := auth.uid();
  v_negocio_id uuid;
  v_saldo numeric;
  v_movimiento caja_movimientos;
begin
  if v_auth_uid is null then
    raise exception 'No autenticado';
  end if;

  v_negocio_id := public.resolver_negocio_id(v_auth_uid);

  if p_tipo not in ('apertura', 'entrada', 'salida', 'cierre') then
    raise exception 'Tipo de movimiento inválido';
  end if;

  if p_monto is null or p_monto < 0 then
    raise exception 'Monto inválido';
  end if;

  if p_uuid is not null then
    select * into v_movimiento
    from caja_movimientos
    where uuid = p_uuid and user_id = v_negocio_id;

    if found then
      return v_movimiento;
    end if;
  end if;

  -- Serializa las llamadas concurrentes del mismo NEGOCIO (antes era
  -- por auth.uid(), lo que dejaba de servir entre dos miembros
  -- distintos del mismo negocio en cuanto cada uno tuvo su propio
  -- auth.uid()).
  perform pg_advisory_xact_lock(hashtext(v_negocio_id::text));

  if p_tipo = 'salida' then
    with sesiones as (
      select
        tipo,
        monto,
        sum(case when tipo = 'apertura' then 1 else 0 end)
          over (order by fecha, id) as sesion
      from caja_movimientos
      where user_id = v_negocio_id
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
    now(), p_tipo, p_monto, nullif(trim(p_motivo), ''), p_monto_esperado, p_diferencia, v_negocio_id, p_uuid
  )
  returning * into v_movimiento;

  return v_movimiento;
end;
$$;

grant execute on function registrar_movimiento_caja(text, numeric, text, numeric, numeric, uuid) to authenticated;

-- 9) PASO APARTE, A CORRER UNA SOLA VEZ, DESPUÉS de aplicar todo lo de
-- arriba y de desplegar el código nuevo (no antes):
--
-- Los tokens de acceso de Supabase se refrescan solos sin cambiar el
-- auth.uid() que llevan adentro. Cualquier sesión de miembro que ya
-- estuviera abierta antes de este cambio (o del dueño mismo) seguiría
-- teniendo, hasta que la cierren a mano, el acceso sin restricciones
-- de siempre — exactamente lo que este cambio busca cerrar. No existe
-- un método del SDK de administración de Supabase para revocar
-- sesiones dando solo el id de un usuario (auth.admin.signOut()
-- necesita el JWT de esa sesión, que no tenemos) — el mecanismo real,
-- documentado por la propia comunidad de Supabase, es borrar sus
-- refresh tokens directamente:
--
-- update: esto SÍ afecta también al dueño de cada negocio con
-- miembros configurados — no hay forma de distinguir "la sesión del
-- dueño" de "la sesión de un miembro" a nivel de token, que es
-- justamente el problema que este cambio corrige. El dueño va a tener
-- que volver a iniciar sesión una vez.
--
-- Nota importante: esto invalida los refresh tokens (impide que la
-- sesión se renueve), pero un access token YA EMITIDO sigue siendo
-- válido hasta que expira por su cuenta (normalmente ~1 hora) —
-- Supabase no permite invalidar un JWT ya emitido antes de su
-- vencimiento natural. El cierre no es instantáneo, pero sí acotado a
-- máximo esa ventana en vez de quedar abierto indefinidamente.
delete from auth.refresh_tokens
where user_id::text in (
  select distinct user_id::text from public.miembros_equipo
);
