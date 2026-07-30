-- =====================================================================
-- Clientes: categoría y calificación
-- =====================================================================
--
-- Se corre UNA vez en el SQL Editor de Supabase. Es seguro sobre datos
-- en producción: solo agrega columnas nuevas, todas opcionales, y no
-- toca ni una fila existente.
--
-- POR QUÉ SOLO ESTAS DOS
--
-- La pantalla de Clientes se rediseñó al estilo de Proveedores: un
-- panel por cliente con gasto total, número de compras y una insignia
-- de categoría. El gasto y las compras ya salen de la tabla `ventas` y
-- no necesitan nada nuevo.
--
-- Lo único que la base no puede deducir es lo que nadie ha registrado
-- nunca:
--
--   categoria     — a qué grupo pertenece el cliente (ej. "Mayoreo",
--                   "Frecuente", "VIP"). Sirve para el filtro de la
--                   parte de arriba, igual que en Proveedores.
--   calificacion  — qué tan buen cliente es, de 1 a 5. Es un juicio del
--                   dueño; no hay forma de calcularlo solo.
--
-- `notas` no se agrega aquí porque la tabla `clientes` YA la tiene
-- desde antes de este archivo.
--
-- No hacen falta políticas nuevas: `clientes` ya tiene RLS activo y las
-- columnas heredan las políticas de la tabla.
-- =====================================================================

alter table public.clientes
  add column if not exists categoria text,
  add column if not exists calificacion smallint;

-- Rango con sentido. Va como restricción y no solo como validación en
-- la pantalla porque la pantalla se puede saltar: cualquiera con la
-- llave anónima puede llamar a la API directamente, y una calificación
-- de 9 sobre 5 rompería las estrellas sin que nadie se enterara.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clientes_calificacion_rango'
  ) then
    alter table public.clientes
      add constraint clientes_calificacion_rango
      check (calificacion is null or (calificacion >= 1 and calificacion <= 5));
  end if;
end $$;

-- Filtrar por categoría dentro de un mismo negocio es la consulta que
-- hace la pantalla al cargar; el índice la sostiene cuando la lista de
-- clientes crece.
create index if not exists clientes_user_categoria_idx
  on public.clientes (user_id, categoria);
