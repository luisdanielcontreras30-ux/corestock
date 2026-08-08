-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase LO ANTES
-- POSIBLE.
--
-- Hallazgo de seguridad: la política "empresa_config_por_dueno" (de
-- supabase_seguridad_rls.sql) permite a cada usuario editar CUALQUIER
-- columna de su propia fila en empresa_config — incluyendo plan,
-- stripe_customer_id, stripe_subscription_id y suscripcion_estado,
-- que agregó supabase_suscripciones.sql sin ajustar esa política.
--
-- Eso significa que cualquier usuario, con su propia sesión y sin
-- ninguna llave especial, puede ejecutar desde la consola del
-- navegador:
--
--   supabase.from('empresa_config').update({ plan: 'plus' }).eq('user_id', miId)
--
-- y auto-otorgarse CoreStock Plus+ sin pagar, evadiendo Stripe por
-- completo.
--
-- Este script agrega un trigger que protege esas 5 columnas: solo se
-- pueden escribir cuando la conexión usa la service_role key (el
-- webhook de Stripe). Cualquier intento de cambiarlas desde el
-- cliente (anon/authenticated) se revierte en silencio, sin romper el
-- resto de la actualización (ej. seguir pudiendo guardar el nombre o
-- logo de la empresa en Configuración).

create or replace function proteger_columnas_suscripcion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    if tg_op = 'INSERT' then
      new.plan := 'free';
      new.stripe_customer_id := null;
      new.stripe_subscription_id := null;
      new.suscripcion_estado := null;
      new.suscripcion_periodo_fin := null;
    elsif tg_op = 'UPDATE' then
      new.plan := old.plan;
      new.stripe_customer_id := old.stripe_customer_id;
      new.stripe_subscription_id := old.stripe_subscription_id;
      new.suscripcion_estado := old.suscripcion_estado;
      new.suscripcion_periodo_fin := old.suscripcion_periodo_fin;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_columnas_suscripcion_trigger on empresa_config;

create trigger proteger_columnas_suscripcion_trigger
before insert or update on empresa_config
for each row
execute function proteger_columnas_suscripcion();
