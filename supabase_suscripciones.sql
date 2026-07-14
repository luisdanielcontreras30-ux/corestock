-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- Agrega el estado de suscripción a empresa_config: qué plan tiene
-- cada negocio (free / plus) y los identificadores de Stripe que
-- permiten sincronizar ese estado desde el webhook. El webhook usa la
-- service_role key (nunca la anon key) para escribir aquí, así que no
-- hace falta una política de RLS adicional para él — las políticas de
-- "empresa_config_por_dueno" ya existentes siguen protegiendo la
-- lectura/escritura desde el cliente.

alter table empresa_config add column if not exists plan text not null default 'free';
alter table empresa_config add column if not exists stripe_customer_id text;
alter table empresa_config add column if not exists stripe_subscription_id text;
alter table empresa_config add column if not exists suscripcion_estado text;
alter table empresa_config add column if not exists suscripcion_periodo_fin timestamptz;

create unique index if not exists empresa_config_stripe_customer_id_key
  on empresa_config (stripe_customer_id)
  where stripe_customer_id is not null;
