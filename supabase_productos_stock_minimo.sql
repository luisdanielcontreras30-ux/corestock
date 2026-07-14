-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- Asegura que exista la columna de stock mínimo por producto, usada
-- ahora por Alertas, el Dashboard y el ícono de notificaciones para
-- decidir cuándo avisar (antes era un umbral fijo de 5 para todos).

alter table productos add column if not exists stock_minimo integer not null default 5;
