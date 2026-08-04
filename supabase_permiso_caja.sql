-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase, DESPUÉS de
-- supabase_permisos_miembros.sql.
--
-- Hasta ahora caja_movimientos quedó con acceso completo para
-- CUALQUIER miembro activo (ver sección 7 de supabase_permisos_
-- miembros.sql) — no había forma de que el dueño le quitara Caja a un
-- miembro del equipo. Esto reemplaza esa política por una que exige el
-- permiso puntual "ver_caja" (nuevo en app/configuracion/types.ts),
-- igual que ya existe para ventas/productos con sus propios permisos.
--
-- IMPORTANTE: los miembros que ya existían antes de correr esto NO
-- tienen "ver_caja" en su lista de permisos guardada (ese campo no se
-- actualiza solo) — aunque antes sí entraban a Caja, después de correr
-- este script se les bloquea hasta que el dueño entre a Configuración →
-- Usuarios → Editar y active la casilla "Acceder a Caja" para cada uno
-- que la necesite (los roles Cajero y Gerente ya la traen marcada por
-- defecto solo para miembros NUEVOS que se creen de aquí en adelante).
drop policy if exists "caja_movimientos_miembro_activo" on public.caja_movimientos;
create policy "caja_movimientos_miembro_permiso" on public.caja_movimientos
  for all
  using (public.miembro_tiene_permiso(user_id, 'ver_caja'))
  with check (public.miembro_tiene_permiso(user_id, 'ver_caja'));
