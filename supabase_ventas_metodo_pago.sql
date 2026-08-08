-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- Agrega el método de pago a cada venta (efectivo, tarjeta,
-- transferencia u otro).

alter table ventas add column if not exists metodo_pago text not null default 'efectivo';
