-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- Agrega el interruptor de "limpieza automática de ventas" que se
-- activa/desactiva desde Configuración → Empresa. Cuando está
-- encendido, la app borra (la próxima vez que alguien abre Ventas, una
-- vez al día como máximo) las ventas de hace más de un mes cuyo total
-- sea menor a 10,000 — pensado para no dejar crecer el historial con
-- transacciones chicas y ya irrelevantes. Apagado por defecto: no borra
-- nada hasta que el dueño lo active a propósito.
alter table public.empresa_config
  add column if not exists limpieza_ventas_activa boolean not null default false;
