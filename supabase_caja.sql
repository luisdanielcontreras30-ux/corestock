-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- Crea (o completa) la tabla "caja_movimientos" que usa el nuevo módulo
-- de Caja, con RLS habilitado.
--
-- Es una bitácora de solo inserción (como una caja real): la app no
-- permite editar ni borrar movimientos una vez registrados.

create table if not exists caja_movimientos (
  id bigint generated always as identity primary key
);

alter table caja_movimientos add column if not exists user_id uuid not null references auth.users(id);
-- tipo: 'apertura' | 'entrada' | 'salida' | 'cierre'
alter table caja_movimientos add column if not exists tipo text not null default 'entrada';
alter table caja_movimientos add column if not exists monto numeric not null default 0;
alter table caja_movimientos add column if not exists motivo text;
-- solo se usan en movimientos tipo 'cierre'
alter table caja_movimientos add column if not exists monto_esperado numeric;
alter table caja_movimientos add column if not exists diferencia numeric;
alter table caja_movimientos add column if not exists fecha timestamptz not null default now();

alter table caja_movimientos enable row level security;

drop policy if exists "caja_movimientos_por_dueno" on caja_movimientos;
create policy "caja_movimientos_por_dueno" on caja_movimientos
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
