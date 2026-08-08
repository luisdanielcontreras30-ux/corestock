-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- La tabla "clientes" ya existe (se usa desde Ventas), esto solo agrega
-- los campos de contacto/notas que necesita la nueva página de Clientes.

alter table clientes
  add column if not exists telefono text,
  add column if not exists correo text,
  add column if not exists notas text,
  add column if not exists created_at timestamptz default now();
