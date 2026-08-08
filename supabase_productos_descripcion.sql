-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- Agrega la columna "descripcion" a productos (la llena el análisis
-- por IA al tomar/subir una foto, pero también se puede editar a
-- mano) y la expone en el catálogo público.

alter table productos add column if not exists descripcion text;

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
  producto_categoria text,
  producto_descripcion text
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
    p.categoria,
    p.descripcion
  from empresa_config e
  left join productos p on p.user_id = e.user_id and p.activo = true
  where e.user_id = p_user_id
    and e.catalogo_activo = true
  order by p.categoria nulls last, p.nombre;
$$;

grant execute on function public.obtener_catalogo_publico(uuid) to anon, authenticated;
