-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- registrarVenta() calcula el precio en el navegador (a partir del
-- precio del producto y la promoción activa) y lo manda ya calculado
-- al insertar — no hay nada del lado del servidor que impida que una
-- llamada manipulada (saltándose la app, directo contra la API de
-- Supabase) inserte una venta con precio o total en cero o negativo.
-- Esta restricción es la validación mínima que no depende de ninguna
-- decisión de negocio: ninguna venta real tiene precio negativo,
-- cantidad <= 0, ni un total que no cuadre con precio * cantidad.
--
-- precio se permite en 0 (no solo > 0): una promoción de 100% de
-- descuento (Promociones sí permite un valor de 100%) vuelve un
-- producto gratis a propósito, así que precio 0 es un caso válido.
--
-- No se agrega un tope de precio (ej. "no puede superar el precio de
-- catálogo") porque Cotizaciones permite precios negociados manualmente
-- que después se convierten en venta con ese mismo precio — limitar
-- eso rompería una función real de la app, no un bug.
--
-- Si ya corriste una versión anterior de este archivo (con
-- "check (precio > 0)"), vuelve a correr este ALTER: reemplaza esa
-- restricción por la correcta sin tocar tus datos.
--
-- Si ya tienes ventas registradas, corre esto antes para confirmar que
-- ninguna fila existente viola las restricciones (si devuelve filas,
-- revísalas antes de aplicar el ALTER de abajo):
--   select * from ventas
--   where precio < 0 or cantidad <= 0 or abs(total - (precio * cantidad)) >= 0.01;

alter table ventas drop constraint if exists ventas_precio_positivo;
alter table ventas add constraint ventas_precio_positivo check (precio >= 0);

alter table ventas drop constraint if exists ventas_cantidad_positiva;
alter table ventas add constraint ventas_cantidad_positiva check (cantidad > 0);

alter table ventas drop constraint if exists ventas_total_coherente;
alter table ventas add constraint ventas_total_coherente check (abs(total - (precio * cantidad)) < 0.01);
