-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase, DESPUÉS de
-- supabase_permisos_miembros.sql.
--
-- Problema que resuelve: MiembroActivoProvider guarda los permisos de
-- un miembro en sessionStorage UNA sola vez, al iniciar sesión, y nunca
-- los vuelve a leer de la base — si el dueño le cambia el rol o los
-- permisos a un miembro que ya tiene la pestaña abierta, esa pestaña
-- sigue usando los permisos viejos hasta que ese miembro cierra sesión
-- y vuelve a entrar. Esta función deja que cada miembro consulte su
-- PROPIA fila para refrescarla en segundo plano sin necesitar el
-- permiso "configuracion" (que es lo que exige la política de SELECT
-- normal de miembros_equipo — un cajero nunca lo tiene, y por eso no
-- podía leer ni su propia fila directamente).
create or replace function public.mi_membresia()
returns table (
  id miembros_equipo.id%type,
  nombre miembros_equipo.nombre%type,
  correo miembros_equipo.correo%type,
  rol miembros_equipo.rol%type,
  permisos miembros_equipo.permisos%type,
  activo miembros_equipo.activo%type,
  tiene_contrasena miembros_equipo.tiene_contrasena%type
)
language sql
security definer
set search_path = public
stable
as $$
  select id, nombre, correo, rol, permisos, activo, tiene_contrasena
  from miembros_equipo
  where auth_user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.mi_membresia() to authenticated;
