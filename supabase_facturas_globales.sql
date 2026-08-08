-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- Crea (o completa) la tabla "facturas_globales" que usa el nuevo
-- módulo de Facturas Globales, con RLS habilitado.
--
-- Cada fila es un resumen (snapshot) de todas las ventas dentro de un
-- rango de fechas, guardado en el momento en que se generó.

create table if not exists facturas_globales (
  id bigint generated always as identity primary key
);

alter table facturas_globales add column if not exists user_id uuid not null references auth.users(id);
alter table facturas_globales add column if not exists fecha_inicio timestamptz not null default now();
alter table facturas_globales add column if not exists fecha_fin timestamptz not null default now();
alter table facturas_globales add column if not exists cantidad_ventas integer not null default 0;
alter table facturas_globales add column if not exists total numeric not null default 0;
alter table facturas_globales add column if not exists nota text;
alter table facturas_globales add column if not exists created_at timestamptz not null default now();

alter table facturas_globales enable row level security;

drop policy if exists "facturas_globales_por_dueno" on facturas_globales;
create policy "facturas_globales_por_dueno" on facturas_globales
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
