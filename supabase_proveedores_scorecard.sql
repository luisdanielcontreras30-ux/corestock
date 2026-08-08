-- =====================================================================
-- Proveedores: categoría, calificación y días de entrega
-- =====================================================================
--
-- Se corre UNA vez en el SQL Editor de Supabase. Es seguro sobre datos
-- en producción: solo agrega columnas nuevas, todas opcionales, y no
-- toca ni una fila existente.
--
-- POR QUÉ SOLO ESTAS TRES
--
-- La pantalla de Proveedores muestra un panel por proveedor con gasto,
-- número de compras, última compra, tendencia del gasto y participación
-- sobre el total. TODO eso ya se calcula a partir de la tabla `compras`
-- y no necesita nada nuevo: no se guarda ningún número derivado, para
-- que no pueda quedar desactualizado.
--
-- Lo único que la base no puede deducir es lo que nadie ha registrado
-- nunca:
--
--   categoria     — a qué familia pertenece el proveedor. Sirve para el
--                   filtro de la parte de arriba.
--   calificacion  — qué tan bien cumple, de 1 a 5. Es un juicio del
--                   dueño; no hay forma de calcularlo solo.
--   dias_entrega  — cuánto tarda normalmente en surtir. Se captura a
--                   mano porque CoreStock no registra la fecha en que se
--                   pidió, solo la fecha en que la mercancía entró.
--
-- Lo que NO se agrega, y por qué: el "% de entregas a tiempo" de un
-- panel de proveedores necesita comparar la fecha comprometida contra
-- la real, y para eso hace falta un módulo de órdenes de compra que
-- CoreStock todavía no tiene. Poner una columna suelta que nadie llena
-- solo dejaría un dato vacío para siempre.
--
-- No hacen falta políticas nuevas: `proveedores` ya tiene RLS activo y
-- las columnas heredan las políticas de la tabla.
-- =====================================================================

alter table public.proveedores
  add column if not exists categoria text,
  add column if not exists calificacion smallint,
  add column if not exists dias_entrega smallint;

-- Rangos con sentido. Van como restricciones y no solo como validación
-- en la pantalla porque la pantalla se puede saltar: cualquiera con la
-- llave anónima puede llamar a la API directamente, y una calificación
-- de 9 sobre 5 rompería las estrellas sin que nadie se enterara.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'proveedores_calificacion_rango'
  ) then
    alter table public.proveedores
      add constraint proveedores_calificacion_rango
      check (calificacion is null or (calificacion >= 1 and calificacion <= 5));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'proveedores_dias_entrega_rango'
  ) then
    alter table public.proveedores
      add constraint proveedores_dias_entrega_rango
      check (dias_entrega is null or (dias_entrega >= 0 and dias_entrega <= 365));
  end if;
end $$;

-- Filtrar por categoría dentro de un mismo negocio es la consulta que
-- hace la pantalla al cargar; el índice la sostiene cuando la lista de
-- proveedores crece.
create index if not exists proveedores_user_categoria_idx
  on public.proveedores (user_id, categoria);
