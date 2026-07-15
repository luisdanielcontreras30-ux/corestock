-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- Catálogo en Línea: agrega el interruptor "catalogo_activo" a
-- empresa_config, y crea una función pública (SECURITY DEFINER) que es
-- la ÚNICA forma en que alguien sin sesión puede leer datos de tu
-- negocio — y solo lo que explícitamente decides mostrar (nombre,
-- logo, color y tus productos activos), y solo cuando tú activaste el
-- catálogo. No se otorga ningún permiso de lectura directo sobre
-- "productos" ni "empresa_config" a usuarios anónimos: todo pasa por
-- esta función, que decide qué columnas devolver.

alter table empresa_config add column if not exists catalogo_activo boolean not null default false;

create or replace function public.obtener_catalogo_publico(p_user_id uuid)
returns table (
  nombre_negocio text,
  logo_url text,
  color_principal text,
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
