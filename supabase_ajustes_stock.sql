-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- Crea (o completa) la tabla "ajustes_stock" que usa el nuevo módulo de
-- Ajustes de Stock, con RLS habilitado.

create table if not exists ajustes_stock (
  id bigint generated always as identity primary key
);

alter table ajustes_stock add column if not exists user_id uuid not null references auth.users(id);
alter table ajustes_stock add column if not exists producto_id bigint references productos(id) on delete set null;
alter table ajustes_stock add column if not exists producto text not null default '';
-- positivo = se agregó stock, negativo = se quitó stock
alter table ajustes_stock add column if not exists cantidad_ajuste integer not null default 0;
alter table ajustes_stock add column if not exists stock_anterior integer not null default 0;
alter table ajustes_stock add column if not exists stock_nuevo integer not null default 0;
alter table ajustes_stock add column if not exists motivo text;
alter table ajustes_stock add column if not exists fecha timestamptz not null default now();
alter table ajustes_stock add column if not exists created_at timestamptz not null default now();

alter table ajustes_stock enable row level security;

drop policy if exists "ajustes_stock_por_dueno" on ajustes_stock;
create policy "ajustes_stock_por_dueno" on ajustes_stock
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
