-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- Crea la tabla que usa el nuevo módulo de Devoluciones, con RLS
-- habilitado.
--
-- Diseño: una devolución es un registro independiente (no revierte
-- una venta específica automáticamente) — guarda cuánto se devolvió
-- de qué producto, cuánto se reembolsó y si esa cantidad vuelve o no
-- al stock vendible (repuso_stock=false para productos defectuosos
-- que no se pueden volver a vender).

create table if not exists devoluciones (
  id bigint generated always as identity primary key
);

alter table devoluciones add column if not exists user_id uuid not null references auth.users(id);
alter table devoluciones add column if not exists producto_id bigint references productos(id) on delete set null;
alter table devoluciones add column if not exists producto text not null default '';
alter table devoluciones add column if not exists cantidad numeric not null default 0;
alter table devoluciones add column if not exists monto_reembolsado numeric not null default 0;
alter table devoluciones add column if not exists motivo text;
alter table devoluciones add column if not exists repuso_stock boolean not null default true;
alter table devoluciones add column if not exists fecha timestamptz not null default now();

alter table devoluciones enable row level security;
drop policy if exists "devoluciones_por_dueno" on devoluciones;
create policy "devoluciones_por_dueno" on devoluciones
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
