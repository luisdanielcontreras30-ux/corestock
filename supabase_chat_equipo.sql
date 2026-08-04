-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase, DESPUÉS de
-- supabase_permisos_miembros.sql (usa la función es_miembro_activo que
-- ese archivo crea).
--
-- Chat de equipo: un solo canal compartido por negocio donde el dueño
-- y todos sus miembros activos pueden escribirse — pensado para avisos
-- rápidos entre quienes atienden el mismo negocio (ej. "ya llegó el
-- pedido", "cambié el precio de X"), no mensajes privados 1 a 1.
create table if not exists public.mensajes_chat (
  id bigint generated always as identity primary key,
  -- Id del NEGOCIO (dueño), no de quien escribe — mismo patrón que el
  -- resto de la app (ver lib/negocioActual.ts). Todos los mensajes de
  -- una cuenta comparten este mismo valor.
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Quién escribió — el auth.uid() real de esa sesión (el dueño o la
  -- identidad propia de un miembro, ver supabase_permisos_miembros.sql).
  autor_id uuid not null,
  -- Nombre a mostrar, guardado tal cual al momento de enviar (no se
  -- resuelve con un join) — mismo patrón que producto_nombre en
  -- recetas/ventas: si ese miembro se elimina después, el mensaje
  -- viejo conserva quién lo mandó en vez de quedar en blanco.
  autor_nombre text not null,
  texto text not null check (char_length(texto) between 1 and 2000),
  creado_en timestamptz not null default now()
);

create index if not exists mensajes_chat_user_id_creado_en_idx
  on public.mensajes_chat (user_id, creado_en);

alter table public.mensajes_chat enable row level security;

drop policy if exists "mensajes_chat_select" on public.mensajes_chat;
create policy "mensajes_chat_select" on public.mensajes_chat
  for select
  using ((select auth.uid()) = user_id or public.es_miembro_activo(user_id));

drop policy if exists "mensajes_chat_insert" on public.mensajes_chat;
create policy "mensajes_chat_insert" on public.mensajes_chat
  for insert
  with check (
    autor_id = (select auth.uid())
    and ((select auth.uid()) = user_id or public.es_miembro_activo(user_id))
  );

-- Bitácora de solo lectura/inserción, igual que Caja: no hay política
-- de update/delete a propósito — nadie edita ni borra un mensaje ya
-- enviado.

-- Habilita las actualizaciones en vivo (Supabase Realtime) para esta
-- tabla — sin esto, un mensaje nuevo solo aparece para los demás
-- cuando vuelven a cargar la página.
alter publication supabase_realtime add table public.mensajes_chat;
