-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- Catálogo en Línea: agrega el interruptor "catalogo_activo" a
-- empresa_config, y crea una función pública (SECURITY DEFINER) que es
-- la ÚNICA forma en que alguien sin sesión puede leer datos de tu
-- negocio — y solo lo que explícitamente decides mostrar (nombre,
-- logo, color, teléfono y tus productos activos), y solo cuando tú
-- activaste el catálogo. El teléfono se incluye a propósito: es el
-- número al que el botón de WhatsApp del catálogo le escribe al
-- cliente final, así que necesariamente es público en esta página.
-- No se otorga ningún permiso de lectura directo sobre "productos" ni
-- "empresa_config" a usuarios anónimos: todo pasa por esta función,
-- que decide qué columnas devolver.
--
-- IMPORTANTE: supabase_productos_descripcion.sql vuelve a definir esta
-- misma función más abajo en el tiempo, agregando la columna de salida
-- "producto_descripcion" (que app/catalogo/[userId]/acciones.ts ya
-- espera recibir). En un proyecto de Supabase nuevo, corre ESTE
-- archivo primero y luego ese, en ese orden — si solo se corre este,
-- el catálogo público funciona pero nunca muestra descripción.

alter table empresa_config add column if not exists catalogo_activo boolean not null default false;

-- Postgres no deja cambiar las columnas de salida de una función con
-- CREATE OR REPLACE — hay que borrarla primero (es seguro, se vuelve a
-- crear justo abajo).
drop function if exists public.obtener_catalogo_publico(uuid);

create function public.obtener_catalogo_publico(p_user_id uuid)
returns table (
  nombre_negocio text,
  logo_url text,
  color_principal text,
  telefono text,
  producto_id bigint,
  producto_nombre text,
  producto_precio numeric,
  producto_imagen text,
  producto_categoria text
)
language sql
security definer
set search_path = public
as $$
  select
    e.nombre_negocio,
    e.logo_url,
    e.color_principal,
    e.telefono,
    p.id,
    p.nombre,
    p.precio_venta,
    p.imagen,
    p.categoria
  from empresa_config e
  left join productos p on p.user_id = e.user_id and p.activo = true
  where e.user_id = p_user_id
    and e.catalogo_activo = true
  order by p.categoria nulls last, p.nombre;
$$;

grant execute on function public.obtener_catalogo_publico(uuid) to anon, authenticated;
