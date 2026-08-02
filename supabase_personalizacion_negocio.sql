-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- CoreStock por tipo de negocio: agrega "tipo_negocio" y
-- "rutas_activas" a empresa_config. No son un plan de suscripción ni
-- una tabla aparte — son dos preferencias más de la cuenta, igual que
-- modo_interfaz (ver supabase_modo_interfaz.sql), cuyo mismo patrón
-- siguen:
--
-- tipo_negocio: qué tipo de negocio eligió la cuenta (lib/tiposNegocio.ts
-- tiene la lista). NULL = todavía no eligió (se le muestra la pantalla
-- de bienvenida, antes de la de modo_interfaz).
--
-- rutas_activas: qué accesos del menú se muestran de entrada. Se llena
-- una sola vez con la recomendación del tipo de negocio elegido
-- (lib/tiposNegocio.ts) y desde ahí lo controla la persona a mano en
-- Configuración > Personalización — NUNCA bloquea nada (toda ruta
-- sigue siendo alcanzable por URL o desde "Más"), solo decide qué
-- aparece en el menú principal. NULL = sin personalizar, se muestra
-- todo el menú (mismo comportamiento que tenían todas las cuentas
-- antes de este cambio); se queda en NULL hasta que la persona elige
-- un tipo de negocio con recomendación o toca un checkbox a mano en
-- Configuración.
--
-- Las cuentas que ya existían se migran a tipo_negocio = 'otro' (sin
-- recomendación, sin tocar rutas_activas) para no atraparlas en una
-- pantalla nueva que no pidieron — mismo trato que
-- supabase_modo_interfaz.sql le dio a modo_interfaz.

alter table empresa_config add column if not exists tipo_negocio text;
alter table empresa_config add column if not exists rutas_activas text[];

update empresa_config set tipo_negocio = 'otro' where tipo_negocio is null;
