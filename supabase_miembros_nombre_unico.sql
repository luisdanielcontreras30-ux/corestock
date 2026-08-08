-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- Contexto: entrar-como-miembro (app/api/miembros/entrar-como-miembro/
-- route.ts) busca al miembro por nombre exacto (sin distinguir
-- mayúsculas/espacios) entre los miembros ACTIVOS, y se queda con la
-- primera coincidencia. La interfaz (UsuariosTab.tsx) ya bloquea crear
-- un segundo miembro activo con el mismo nombre revisando la lista ya
-- cargada en el navegador, pero eso no cubre dos guardados casi
-- simultáneos (dos pestañas, o dos administradores a la vez): ambos
-- ven la lista sin el nuevo miembro todavía y los dos pasan el
-- chequeo, quedando dos miembros activos con el mismo nombre — el
-- segundo nunca podría entrar, sin importar que su contraseña sea
-- correcta, porque la búsqueda siempre resuelve en el primero.
--
-- Este índice cierra esa ventana a nivel de base de datos. Se limita a
-- "where activo = true" porque es exactamente el mismo filtro que usa
-- el login — nombres repetidos entre miembros ya desactivados no
-- generan la ambigüedad real y no deberían bloquear nada.

create unique index if not exists miembros_equipo_nombre_activo_unico
  on public.miembros_equipo (user_id, lower(trim(nombre)))
  where activo = true;
