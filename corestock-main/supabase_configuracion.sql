-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.

-- 1. Configuración de la empresa (una fila por cuenta)
create table if not exists empresa_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  nombre_negocio text,
  logo_url text,
  direccion text,
  telefono text,
  correo text,
  rfc text,
  moneda text default 'MXN',
  zona_horaria text default 'America/Mexico_City',
  idioma text default 'es',
  color_principal text default '#5945e4',
  creado_en timestamptz default now()
);

alter table empresa_config enable row level security;

create policy "empresa_config_select" on empresa_config
  for select using (auth.uid() = user_id);

create policy "empresa_config_insert" on empresa_config
  for insert with check (auth.uid() = user_id);

create policy "empresa_config_update" on empresa_config
  for update using (auth.uid() = user_id);

-- 2. Miembros del equipo (roles y permisos)
-- Nota: esto NO crea cuentas de acceso reales (usuarios que puedan
-- iniciar sesión por su cuenta) — eso requiere un backend con la
-- Service Role Key de Supabase, que nunca debe exponerse en el
-- navegador. Esta tabla sirve para organizar roles y permisos del
-- equipo dentro de tu cuenta.
create table if not exists miembros_equipo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  correo text,
  rol text not null default 'cajero',
  permisos jsonb not null default '[]'::jsonb,
  activo boolean not null default true,
  creado_en timestamptz default now()
);

alter table miembros_equipo enable row level security;

create policy "miembros_equipo_select" on miembros_equipo
  for select using (auth.uid() = user_id);

create policy "miembros_equipo_insert" on miembros_equipo
  for insert with check (auth.uid() = user_id);

create policy "miembros_equipo_update" on miembros_equipo
  for update using (auth.uid() = user_id);

create policy "miembros_equipo_delete" on miembros_equipo
  for delete using (auth.uid() = user_id);
