-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- CoreStock Easy: agrega "modo_interfaz" a empresa_config. No es un
-- plan de suscripción nuevo ni una tabla aparte — es una preferencia
-- de negocio más, igual que color_principal o idioma, que decide qué
-- tan simplificada se ve la interfaz para toda la cuenta (dueño y
-- miembros del equipo por igual).
--
-- Se deja NULL por defecto a propósito (no "completo"): así se puede
-- distinguir "cuenta que todavía no eligió" (se le muestra la
-- pantalla de bienvenida) de "cuenta que ya eligió completo" (no se
-- le vuelve a preguntar). Las cuentas que ya existían antes de este
-- cambio se migran explícitamente a "completo" para no sorprender a
-- nadie con una pantalla nueva que no pidió.

alter table empresa_config add column if not exists modo_interfaz text;

update empresa_config set modo_interfaz = 'completo' where modo_interfaz is null;
