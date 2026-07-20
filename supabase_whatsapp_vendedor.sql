-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- Vendedor de WhatsApp (fase 2, conexión real): guarda el "Phone
-- Number ID" de la cuenta de WhatsApp Business API del negocio. El
-- webhook que recibe los mensajes entrantes no tiene sesión de
-- usuario — usa este campo para identificar a qué negocio pertenece
-- cada mensaje (Meta manda el phone_number_id en cada evento).

alter table empresa_config add column if not exists whatsapp_phone_number_id text;

-- Evita que dos negocios queden apuntando al mismo número por error
-- (cada número de WhatsApp Business solo puede pertenecer a uno).
create unique index if not exists empresa_config_whatsapp_phone_number_id_key
  on empresa_config (whatsapp_phone_number_id)
  where whatsapp_phone_number_id is not null;
