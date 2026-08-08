-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- Convierte las cotizaciones de UNA sola línea a varias líneas, y hace
-- que además de productos del inventario se puedan cotizar SERVICIOS y
-- MANO DE OBRA — cosas que no existen en Productos y que no descuentan
-- stock. Es lo que hace que el módulo sirva para un taller, un
-- autolavado o cualquier negocio que cobra trabajo, no solo mercancía.
--
-- Compatibilidad: las cotizaciones que ya existen NO se tocan ni se
-- migran. Siguen guardando su única línea en las columnas de
-- "cotizaciones" (producto, cantidad, precio_unitario), y la aplicación
-- las muestra igual: cuando una cotización no tiene filas aquí, arma la
-- línea a partir de esas columnas. Por eso esta migración es segura de
-- correr con datos en producción y no hay nada que deshacer.
--
-- Mientras esta migración no esté aplicada, Cotizaciones sigue
-- funcionando en modo de una sola línea (la aplicación lo detecta y
-- avisa en la consola).

create table if not exists cotizacion_items (
  id bigint generated always as identity primary key
);

alter table cotizacion_items add column if not exists cotizacion_id bigint not null
  references cotizaciones(id) on delete cascade;
alter table cotizacion_items add column if not exists user_id uuid not null references auth.users(id);

-- tipo: 'producto' | 'servicio' | 'mano_obra'
--   producto  → sale del inventario, descuenta stock al convertir en venta
--   servicio  → trabajo cobrado (ej. "detallado de interior"), sin stock
--   mano_obra → horas de trabajo, sin stock
alter table cotizacion_items add column if not exists tipo text not null default 'producto';

-- Solo se llena en las líneas de tipo 'producto'. Queda en null si el
-- producto se borra después: la cotización histórica no debe romperse
-- por eso, y la descripción de abajo conserva el nombre tal como estaba.
alter table cotizacion_items add column if not exists producto_id bigint
  references productos(id) on delete set null;

alter table cotizacion_items add column if not exists descripcion text not null default '';
-- numeric y no integer: un servicio puede cobrarse por 1.5 horas.
alter table cotizacion_items add column if not exists cantidad numeric not null default 1;
alter table cotizacion_items add column if not exists precio_unitario numeric not null default 0;
alter table cotizacion_items add column if not exists total numeric not null default 0;
-- Para conservar el orden en que se capturaron las líneas.
alter table cotizacion_items add column if not exists orden integer not null default 0;
alter table cotizacion_items add column if not exists created_at timestamptz not null default now();

-- Se llena cuando la línea se convierte en una venta real, igual que
-- cotizaciones.venta_id. Permite saber qué líneas ya se cobraron.
alter table cotizacion_items add column if not exists venta_id bigint
  references ventas(id) on delete set null;

alter table cotizacion_items
  drop constraint if exists cotizacion_items_tipo_valido;
alter table cotizacion_items
  add constraint cotizacion_items_tipo_valido
  check (tipo in ('producto', 'servicio', 'mano_obra'));

-- Cantidad y precio no negativos. La validación también está en el
-- cliente, pero esta es la que no se puede saltar.
alter table cotizacion_items
  drop constraint if exists cotizacion_items_montos_validos;
alter table cotizacion_items
  add constraint cotizacion_items_montos_validos
  check (cantidad > 0 and precio_unitario >= 0);

-- Siempre se leen todas las líneas de una cotización a la vez.
create index if not exists cotizacion_items_por_cotizacion
  on cotizacion_items (cotizacion_id, orden);

alter table cotizacion_items enable row level security;

drop policy if exists "cotizacion_items_por_dueno" on cotizacion_items;
create policy "cotizacion_items_por_dueno" on cotizacion_items
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Misma política que el resto de las tablas del negocio para que los
-- miembros del equipo también las vean (ver supabase_permisos_miembros.sql).
-- Se crea solo si esa migración ya corrió y la función existe.
do $$
begin
  if to_regprocedure('public.es_miembro_activo(uuid)') is not null then
    execute 'drop policy if exists "cotizacion_items_miembro_activo" on public.cotizacion_items';
    execute 'create policy "cotizacion_items_miembro_activo" on public.cotizacion_items
             for all
             using (public.es_miembro_activo(user_id))
             with check (public.es_miembro_activo(user_id))';
  end if;
end $$;
