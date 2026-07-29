-- =====================================================================
-- Apariencia del catálogo en línea
-- =====================================================================
--
-- Se corre UNA vez en el SQL Editor de Supabase, DESPUÉS de
-- supabase_catalogo_linea.sql y supabase_productos_descripcion.sql
-- (este archivo vuelve a crear la misma función pública que ellos, con
-- las columnas de apariencia añadidas al final).
--
-- Es seguro sobre datos en producción: las columnas nuevas son
-- opcionales y ninguna fila existente se toca. Mientras estén vacías,
-- el catálogo se ve exactamente igual que hoy.
--
-- QUÉ SE GUARDA
--
--   catalogo_color_fondo     — fondo de la página del catálogo
--   catalogo_color_producto  — fondo de las tarjetas de producto
--   catalogo_color_borde     — su borde
--   catalogo_color_titulo    — el nombre del producto
--   catalogo_color_precio    — los precios
--   catalogo_color_boton     — los botones (Cotizar / WhatsApp)
--   catalogo_colores_categoria — un color por categoría, como
--       {"Bebidas": "#3b82f6", "Botanas": "#f97316"}
--
-- Las categorías van en JSON y no en una tabla aparte a propósito: son
-- texto libre de la tabla de productos, no entidades con identidad
-- propia. Con una tabla habría que mantener sincronizadas las filas
-- cada vez que alguien renombra una categoría en un producto, y las
-- huérfanas se acumularían en silencio. Aquí, una categoría que deja de
-- existir simplemente deja de leerse.
--
-- Todo esto vive en empresa_config, que ya tiene RLS: las columnas
-- heredan las políticas de la tabla. Al catálogo público llegan por la
-- función de abajo, que sigue decidiendo columna por columna qué se
-- expone a quien no tiene sesión.
-- =====================================================================

alter table public.empresa_config
  add column if not exists catalogo_color_fondo text,
  add column if not exists catalogo_color_producto text,
  add column if not exists catalogo_color_borde text,
  add column if not exists catalogo_color_titulo text,
  add column if not exists catalogo_color_precio text,
  add column if not exists catalogo_color_boton text,
  add column if not exists catalogo_colores_categoria jsonb not null default '{}'::jsonb;

-- Los colores se pintan tal cual en el navegador de un cliente final.
-- Un valor que no sea un hex de 6 dígitos no es solo feo: es texto
-- ajeno entrando a un atributo de estilo, así que se rechaza en la base
-- y no solo en la pantalla, que cualquiera puede saltarse llamando a la
-- API directamente.
-- Se borra antes de crearla: si este archivo ya se corrió con menos
-- colores, la restricción vieja seguiría en pie y no cubriría los
-- nuevos. Así el archivo se puede volver a ejecutar sin problema.
alter table public.empresa_config
  drop constraint if exists empresa_config_colores_catalogo_hex;

alter table public.empresa_config
  add constraint empresa_config_colores_catalogo_hex check (
    (catalogo_color_fondo is null or catalogo_color_fondo ~ '^#[0-9A-Fa-f]{6}$')
    and (catalogo_color_producto is null or catalogo_color_producto ~ '^#[0-9A-Fa-f]{6}$')
    and (catalogo_color_borde is null or catalogo_color_borde ~ '^#[0-9A-Fa-f]{6}$')
    and (catalogo_color_titulo is null or catalogo_color_titulo ~ '^#[0-9A-Fa-f]{6}$')
    and (catalogo_color_precio is null or catalogo_color_precio ~ '^#[0-9A-Fa-f]{6}$')
    and (catalogo_color_boton is null or catalogo_color_boton ~ '^#[0-9A-Fa-f]{6}$')
  );

-- Postgres no deja cambiar las columnas de salida de una función con
-- CREATE OR REPLACE — hay que borrarla primero (es seguro, se vuelve a
-- crear justo abajo con todo lo que ya devolvía).
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
  producto_descripcion text,
  catalogo_color_fondo text,
  catalogo_color_producto text,
  catalogo_color_borde text,
  catalogo_color_titulo text,
  catalogo_color_precio text,
  catalogo_color_boton text,
  catalogo_colores_categoria jsonb
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
    p.descripcion,
    e.catalogo_color_fondo,
    e.catalogo_color_producto,
    e.catalogo_color_borde,
    e.catalogo_color_titulo,
    e.catalogo_color_precio,
    e.catalogo_color_boton,
    e.catalogo_colores_categoria
  from empresa_config e
  left join productos p on p.user_id = e.user_id and p.activo = true
  where e.user_id = p_user_id
    and e.catalogo_activo = true
  order by p.categoria nulls last, p.nombre;
$$;

grant execute on function public.obtener_catalogo_publico(uuid) to anon, authenticated;
