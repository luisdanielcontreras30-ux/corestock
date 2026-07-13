-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- Crea la tabla que usa el nuevo módulo de Conciliaciones, con RLS
-- habilitado.

create table if not exists conciliaciones (
  id bigint generated always as identity primary key
);

alter table conciliaciones add column if not exists user_id uuid not null references auth.users(id);
alter table conciliaciones add column if not exists fecha timestamptz not null default now();
alter table conciliaciones add column if not exists descripcion text not null default '';
-- tipo: 'cargo' (dinero que sale) | 'abono' (dinero que entra)
alter table conciliaciones add column if not exists tipo text not null default 'abono';
alter table conciliaciones add column if not exists monto numeric not null default 0;
alter table conciliaciones add column if not exists conciliado boolean not null default false;
alter table conciliaciones add column if not exists created_at timestamptz not null default now();

alter table conciliaciones enable row level security;
drop policy if exists "conciliaciones_por_dueno" on conciliaciones;
create policy "conciliaciones_por_dueno" on conciliaciones
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
