-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase, DESPUÉS de
-- supabase_chat_equipo.sql.
--
-- Agrega la posibilidad de mandar una foto en el chat de equipo, sola
-- o junto con texto. Reutiliza el mismo bucket "productos" que ya usan
-- las fotos de producto y el logo del negocio (con el prefijo "chat-"
-- en el nombre del archivo) — no hace falta crear ni configurar un
-- bucket nuevo.
alter table public.mensajes_chat
  add column if not exists imagen_url text;

-- El check original exigía texto de 1 a 2000 caracteres siempre — un
-- mensaje que es SOLO una foto ahora es válido, mientras el texto no
-- se pase de 2000 si viene junto con la imagen.
alter table public.mensajes_chat
  drop constraint if exists mensajes_chat_texto_check;

alter table public.mensajes_chat
  add constraint mensajes_chat_contenido_check
  check (
    char_length(texto) <= 2000
    and (char_length(texto) > 0 or imagen_url is not null)
  );
