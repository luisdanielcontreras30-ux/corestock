-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- Agrega el campo "costo" a productos, necesario para calcular
-- ganancias reales (precio de venta - costo) en el Asistente.

alter table productos
  add column if not exists costo numeric default 0;
