-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- Crea (o completa) las tablas que usa el nuevo módulo de Fabricación,
-- con RLS habilitado.
--
-- Nota: "materias_primas" y "recetas" ya existían en tu base (creadas
-- de antes, sin usarse todavía) y habían quedado con RLS activado pero
-- SIN ninguna política — es decir, bloqueadas por completo. Este script
-- les agrega las columnas que necesita el módulo y la política real de
-- "cada quien ve/edita lo suyo".

create table if not exists materias_primas (
  id bigint generated always as identity primary key
);

alter table materias_primas add column if not exists user_id uuid not null references auth.users(id);
alter table materias_primas add column if not exists nombre text not null default '';
alter table materias_primas add column if not exists unidad text not null default 'unidad';
alter table materias_primas add column if not exists stock numeric not null default 0;
alter table materias_primas add column if not exists costo_unitario numeric not null default 0;
alter table materias_primas add column if not exists created_at timestamptz not null default now();

alter table materias_primas enable row level security;
drop policy if exists "materias_primas_por_dueno" on materias_primas;
create policy "materias_primas_por_dueno" on materias_primas
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists recetas (
  id bigint generated always as identity primary key
);

alter table recetas add column if not exists user_id uuid not null references auth.users(id);
alter table recetas add column if not exists producto_id bigint references productos(id) on delete cascade;
alter table recetas add column if not exists producto_nombre text;
alter table recetas add column if not exists materia_prima_id bigint references materias_primas(id) on delete cascade;
alter table recetas add column if not exists materia_prima_nombre text;
alter table recetas add column if not exists cantidad_por_unidad numeric not null default 0;
alter table recetas add column if not exists created_at timestamptz not null default now();

alter table recetas enable row level security;
drop policy if exists "recetas_por_dueno" on recetas;
create policy "recetas_por_dueno" on recetas
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists producciones (
  id bigint generated always as identity primary key
);

alter table producciones add column if not exists user_id uuid not null references auth.users(id);
alter table producciones add column if not exists producto_id bigint references productos(id) on delete set null;
alter table producciones add column if not exists producto_nombre text not null default '';
alter table producciones add column if not exists cantidad numeric not null default 0;
alter table producciones add column if not exists fecha timestamptz not null default now();

alter table producciones enable row level security;
drop policy if exists "producciones_por_dueno" on producciones;
create policy "producciones_por_dueno" on producciones
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
