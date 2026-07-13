-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- Crea (o completa, si ya existía con otra forma) la tabla "compras"
-- que usa el nuevo módulo de Compras, con RLS habilitado.

create table if not exists compras (
  id bigint generated always as identity primary key
);

alter table compras add column if not exists user_id uuid not null references auth.users(id);
alter table compras add column if not exists producto_id bigint references productos(id) on delete set null;
alter table compras add column if not exists producto text not null default '';
alter table compras add column if not exists proveedor_id uuid references proveedores(id) on delete set null;
alter table compras add column if not exists proveedor_nombre text;
alter table compras add column if not exists cantidad integer not null default 0;
alter table compras add column if not exists costo_unitario numeric not null default 0;
alter table compras add column if not exists total numeric not null default 0;
alter table compras add column if not exists nota text;
alter table compras add column if not exists fecha timestamptz not null default now();
alter table compras add column if not exists created_at timestamptz not null default now();

alter table compras enable row level security;

drop policy if exists "compras_por_dueno" on compras;
create policy "compras_por_dueno" on compras
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
