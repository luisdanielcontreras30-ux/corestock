-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase, DESPUÉS de
-- supabase_chat_imagenes.sql.
--
-- Agrega mensajes de voz al chat de equipo (botón de "mantener
-- presionado para hablar", tipo radio/walkie-talkie): se graban en el
-- navegador y se suben como un archivo de audio corto, igual que ya
-- pasa con las fotos — no es una llamada en vivo, es un mensaje más
-- que queda en el historial para escucharse cuando sea.
alter table public.mensajes_chat
  add column if not exists audio_url text;

-- Un mensaje ahora puede ser solo texto, solo foto, solo audio, o
-- cualquier combinación — mientras tenga AL MENOS uno de los tres.
alter table public.mensajes_chat
  drop constraint if exists mensajes_chat_contenido_check;

alter table public.mensajes_chat
  add constraint mensajes_chat_contenido_check
  check (
    char_length(texto) <= 2000
    and (char_length(texto) > 0 or imagen_url is not null or audio_url is not null)
  );
