-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- Crea (o completa) la tabla "cotizaciones" que usa el nuevo módulo de
-- Cotizaciones, con RLS habilitado.

create table if not exists cotizaciones (
  id bigint generated always as identity primary key
);

alter table cotizaciones add column if not exists user_id uuid not null references auth.users(id);
alter table cotizaciones add column if not exists cliente_id bigint references clientes(id) on delete set null;
alter table cotizaciones add column if not exists cliente_nombre text;
alter table cotizaciones add column if not exists producto_id bigint references productos(id) on delete set null;
alter table cotizaciones add column if not exists producto text not null default '';
alter table cotizaciones add column if not exists cantidad integer not null default 0;
alter table cotizaciones add column if not exists precio_unitario numeric not null default 0;
alter table cotizaciones add column if not exists total numeric not null default 0;
-- estado: 'pendiente' | 'aceptada' | 'rechazada'
alter table cotizaciones add column if not exists estado text not null default 'pendiente';
alter table cotizaciones add column if not exists nota text;
alter table cotizaciones add column if not exists fecha timestamptz not null default now();
alter table cotizaciones add column if not exists created_at timestamptz not null default now();

alter table cotizaciones enable row level security;

drop policy if exists "cotizaciones_por_dueno" on cotizaciones;
create policy "cotizaciones_por_dueno" on cotizaciones
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
