-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- Agrega foto y descripción a "ubicaciones" (las venía creando y
-- borrando el módulo de Traspasos, con solo un nombre) para el nuevo
-- módulo Almacenes, que ahora es dueño de administrarlas.

alter table ubicaciones add column if not exists descripcion text;
alter table ubicaciones add column if not exists foto_url text;
