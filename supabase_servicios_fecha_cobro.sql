-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase (después de
-- supabase_servicios.sql).
--
-- Bug: el Dashboard y Gráficas sumaban los trabajos cobrados usando la
-- columna "fecha" de servicios_trabajos como si fuera la fecha de
-- cobro. Esa columna es la fecha del TRABAJO, elegida a mano en el
-- formulario (puede ser cualquier día, pasado o futuro) y nunca cambia
-- cuando el trabajo pasa a "cobrado" después. Resultado: un trabajo
-- cobrado hoy pero con fecha de ayer (o de la semana pasada) no
-- aparecía en "Ingresos de hoy", aunque el dinero sí haya entrado hoy.
--
-- Esta columna nueva guarda el momento real en que el trabajo se marcó
-- como cobrado, para que el ingreso se cuente el día en que de verdad
-- se cobró.

alter table servicios_trabajos add column if not exists fecha_cobro timestamptz;
