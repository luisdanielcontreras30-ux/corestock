-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase (después de
-- supabase_servicios.sql).
--
-- "Servicios rápidos": una plantilla guardada de un servicio que se
-- repite seguido (ej. en un lavado de autos: "Lavado básico", "Lavado
-- premium", "Encerado", cada uno con su precio fijo). En vez de llenar
-- el formulario completo cada vez, se toca la plantilla y se registra
-- el trabajo YA COBRADO en un solo paso — ver registrarServicioRapido()
-- en app/servicios/acciones.ts.

create table if not exists servicios_plantillas (
  id bigint generated always as identity primary key
);

alter table servicios_plantillas add column if not exists user_id uuid not null references auth.users(id);
alter table servicios_plantillas add column if not exists nombre text not null default '';
alter table servicios_plantillas add column if not exists precio numeric not null default 0;
alter table servicios_plantillas add column if not exists created_at timestamptz not null default now();

alter table servicios_plantillas enable row level security;

drop policy if exists "servicios_plantillas_por_dueno" on servicios_plantillas;
create policy "servicios_plantillas_por_dueno" on servicios_plantillas
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Mismo motivo que servicios_trabajos_miembro_activo en
-- supabase_servicios.sql: un miembro del equipo escribe con SU PROPIO
-- auth.uid(), no con el del dueño.
drop policy if exists "servicios_plantillas_miembro_activo" on servicios_plantillas;
create policy "servicios_plantillas_miembro_activo" on servicios_plantillas
  for all
  using (public.es_miembro_activo(user_id))
  with check (public.es_miembro_activo(user_id));

create index if not exists servicios_plantillas_user_idx
  on servicios_plantillas (user_id);
