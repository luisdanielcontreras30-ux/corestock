-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- Crea las tablas que usa el nuevo módulo de Traspasos, con RLS
-- habilitado.
--
-- Diseño: el stock "principal" de un producto sigue siendo
-- productos.stock (el que usan Ventas, Compras, Fabricación, etc. sin
-- ningún cambio). Las "ubicaciones" son almacenes secundarios — su
-- stock vive aparte, en stock_ubicaciones, y un traspaso mueve
-- cantidad entre la Tienda (productos.stock) y una ubicación, o entre
-- dos ubicaciones.

create table if not exists ubicaciones (
  id bigint generated always as identity primary key
);

alter table ubicaciones add column if not exists user_id uuid not null references auth.users(id);
alter table ubicaciones add column if not exists nombre text not null default '';
alter table ubicaciones add column if not exists created_at timestamptz not null default now();

alter table ubicaciones enable row level security;
drop policy if exists "ubicaciones_por_dueno" on ubicaciones;
create policy "ubicaciones_por_dueno" on ubicaciones
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists stock_ubicaciones (
  id bigint generated always as identity primary key
);

alter table stock_ubicaciones add column if not exists user_id uuid not null references auth.users(id);
alter table stock_ubicaciones add column if not exists producto_id bigint not null references productos(id) on delete cascade;
alter table stock_ubicaciones add column if not exists ubicacion_id bigint not null references ubicaciones(id) on delete cascade;
alter table stock_ubicaciones add column if not exists stock numeric not null default 0;
alter table stock_ubicaciones add column if not exists created_at timestamptz not null default now();

-- Evita dos filas de stock para el mismo producto en la misma ubicación.
create unique index if not exists stock_ubicaciones_producto_ubicacion_key
  on stock_ubicaciones (producto_id, ubicacion_id);

alter table stock_ubicaciones enable row level security;
drop policy if exists "stock_ubicaciones_por_dueno" on stock_ubicaciones;
create policy "stock_ubicaciones_por_dueno" on stock_ubicaciones
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists traspasos (
  id bigint generated always as identity primary key
);

alter table traspasos add column if not exists user_id uuid not null references auth.users(id);
alter table traspasos add column if not exists producto_id bigint references productos(id) on delete set null;
alter table traspasos add column if not exists producto_nombre text not null default '';
alter table traspasos add column if not exists ubicacion_origen_id bigint references ubicaciones(id) on delete set null;
-- null = Tienda (stock principal del producto)
alter table traspasos add column if not exists ubicacion_origen_nombre text;
alter table traspasos add column if not exists ubicacion_destino_id bigint references ubicaciones(id) on delete set null;
alter table traspasos add column if not exists ubicacion_destino_nombre text;
alter table traspasos add column if not exists cantidad numeric not null default 0;
alter table traspasos add column if not exists fecha timestamptz not null default now();

alter table traspasos enable row level security;
drop policy if exists "traspasos_por_dueno" on traspasos;
create policy "traspasos_por_dueno" on traspasos
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
