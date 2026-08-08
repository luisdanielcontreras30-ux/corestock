-- =====================================================================
-- Clientes: categoría
-- =====================================================================
--
-- Se corre UNA vez en el SQL Editor de Supabase. Es seguro sobre datos
-- en producción: solo agrega una columna nueva, opcional, y no toca ni
-- una fila existente.
--
-- POR QUÉ SOLO ESTA
--
-- La pantalla de Clientes se rediseñó al estilo de Proveedores: un
-- panel por cliente con gasto total, número de compras, calificación
-- por estrellas y una insignia de categoría. El gasto, las compras y
-- las estrellas (una por compra, tope 5 — ver estrellasPorCompras en
-- app/clientes/types.ts) ya salen de datos que la base ya tiene y no
-- necesitan columnas nuevas.
--
-- Lo único que la base no puede deducir es lo que nadie ha registrado
-- nunca:
--
--   categoria — a qué grupo pertenece el cliente (ej. "Mayoreo",
--               "Frecuente", "VIP"). Sirve para el filtro de la parte
--               de arriba, igual que en Proveedores.
--
-- `notas` no se agrega aquí porque la tabla `clientes` YA la tiene
-- desde antes de este archivo. Este archivo ya no toca `calificacion`
-- — versiones anteriores la agregaban para un campo editable a mano
-- que se reemplazó por las estrellas automáticas; si tu base ya tiene
-- esa columna de una migración vieja, dejarla ahí no hace daño, la app
-- simplemente no la usa.
--
-- No hacen falta políticas nuevas: `clientes` ya tiene RLS activo y la
-- columna hereda las políticas de la tabla.
-- =====================================================================

alter table public.clientes
  add column if not exists categoria text;

-- Filtrar por categoría dentro de un mismo negocio es la consulta que
-- hace la pantalla al cargar; el índice la sostiene cuando la lista de
-- clientes crece.
create index if not exists clientes_user_categoria_idx
  on public.clientes (user_id, categoria);
