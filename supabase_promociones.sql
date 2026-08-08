-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- Crea (o completa) la tabla "promociones" que usa el nuevo módulo de
-- Promociones, con RLS habilitado.

create table if not exists promociones (
  id bigint generated always as identity primary key
);

alter table promociones add column if not exists user_id uuid not null references auth.users(id);
alter table promociones add column if not exists nombre text not null default '';
-- producto_id null = la promoción aplica a todos los productos
alter table promociones add column if not exists producto_id bigint references productos(id) on delete set null;
alter table promociones add column if not exists producto text;
-- tipo: 'porcentaje' | 'monto'
alter table promociones add column if not exists tipo text not null default 'porcentaje';
alter table promociones add column if not exists valor numeric not null default 0;
alter table promociones add column if not exists fecha_inicio timestamptz;
alter table promociones add column if not exists fecha_fin timestamptz;
alter table promociones add column if not exists activa boolean not null default true;
alter table promociones add column if not exists created_at timestamptz not null default now();

alter table promociones enable row level security;

drop policy if exists "promociones_por_dueno" on promociones;
create policy "promociones_por_dueno" on promociones
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
