-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- Contraseña individual por miembro del equipo: agrega la columna
-- donde se guarda el hash (nunca la contraseña en texto plano) y una
-- columna calculada "tiene_contrasena" para que la app sepa quién ya
-- tiene una configurada sin necesidad de leer el hash. El hash solo
-- se lee y se escribe desde rutas de servidor (app/api/miembros/**)
-- con la service_role key — nunca se expone al navegador.

alter table public.miembros_equipo
  add column if not exists password_hash text;

alter table public.miembros_equipo
  add column if not exists tiene_contrasena boolean generated always as (password_hash is not null) stored;
