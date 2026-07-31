-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- Crea la tabla que usa el nuevo módulo de Servicios, con RLS
-- habilitado.
--
-- Para qué es: negocios que no venden productos sino trabajos —
-- lavado de autos, limpieza de casas, y similares. Cada fila es UN
-- trabajo: para quién, qué servicio, cuándo, cuánto cobra y en qué
-- estado va (pendiente / hecho / cobrado).
--
-- cliente_id es opcional a propósito: un trabajo puede ser para
-- alguien que ya está en Clientes (se guarda el id, por si se borra o
-- renombra el cliente después) o para alguien que se anota solo por
-- nombre la primera vez, igual que proveedor_nombre en Compras.

create table if not exists servicios_trabajos (
  id bigint generated always as identity primary key
);

alter table servicios_trabajos add column if not exists user_id uuid not null references auth.users(id);
alter table servicios_trabajos add column if not exists cliente_id bigint references clientes(id) on delete set null;
alter table servicios_trabajos add column if not exists cliente_nombre text not null default '';
alter table servicios_trabajos add column if not exists servicio text not null default '';
alter table servicios_trabajos add column if not exists fecha timestamptz not null default now();
alter table servicios_trabajos add column if not exists precio numeric not null default 0;
-- pendiente | hecho | cobrado
alter table servicios_trabajos add column if not exists estado text not null default 'pendiente';
alter table servicios_trabajos add column if not exists notas text;
alter table servicios_trabajos add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'servicios_trabajos_estado_valido'
  ) then
    alter table servicios_trabajos
      add constraint servicios_trabajos_estado_valido
      check (estado in ('pendiente', 'hecho', 'cobrado'));
  end if;
end $$;

alter table servicios_trabajos enable row level security;

drop policy if exists "servicios_trabajos_por_dueno" on servicios_trabajos;
create policy "servicios_trabajos_por_dueno" on servicios_trabajos
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Un miembro del equipo escribe con SU PROPIO auth.uid(), no con el
-- del dueño — la política de arriba (auth.uid() = user_id) nunca la
-- cumple un miembro, aunque acciones.ts guarde el trabajo con el
-- user_id correcto del negocio. Sin esta segunda política, cualquier
-- miembro vería la lista siempre vacía y no podría registrar nada; es
-- el mismo tratamiento que ya tienen clientes/proveedores/compras/etc.
-- en supabase_permisos_miembros.sql, solo que esa tabla no existía
-- todavía cuando se corrió ese archivo. Las políticas "for all" se
-- combinan con OR, así que esta se suma a la del dueño en vez de
-- reemplazarla.
drop policy if exists "servicios_trabajos_miembro_activo" on servicios_trabajos;
create policy "servicios_trabajos_miembro_activo" on servicios_trabajos
  for all
  using (public.es_miembro_activo(user_id))
  with check (public.es_miembro_activo(user_id));

-- La pantalla ordena por fecha al cargar; el índice la sostiene cuando
-- la lista de trabajos crece.
create index if not exists servicios_trabajos_user_fecha_idx
  on servicios_trabajos (user_id, fecha desc);
