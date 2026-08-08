-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- Contexto: el Dashboard (app/menu/page.tsx) traía TODA la tabla
-- "ventas" en cada visita (`select("*")` sin límite ni rango de
-- fechas), solo para poder ofrecer el ranking "Top artículos" /
-- "Mejores clientes" en el período "todo" (todo el historial). Entre
-- más crece el negocio, más lenta y pesada se vuelve la página que
-- más se visita.
--
-- El código ahora solo trae una ventana acotada (últimos 40 días,
-- suficiente para las tarjetas de hoy/semana/mes y la gráfica de 7
-- días) y delega el único caso que sí necesita el historial completo
-- — el ranking en modo "todo" — a estas dos funciones, que agregan en
-- la base de datos y regresan nada más el top 5.
--
-- Nota de seguridad: son "security invoker" (el valor por default), no
-- "security definer" — se ejecutan con los permisos de quien llama,
-- así que las políticas RLS existentes sobre "ventas" y "clientes"
-- (dueño o miembro con "ver_ventas") siguen aplicando exactamente
-- igual que si el cliente hiciera el select directo.

create or replace function public.dashboard_top_articulos(p_limite int default 5)
returns table(producto text, total numeric)
language sql
stable
as $$
  select v.producto, sum(v.total)::numeric as total
  from ventas v
  group by v.producto
  order by sum(v.total) desc
  limit p_limite;
$$;

grant execute on function public.dashboard_top_articulos(int) to authenticated;

create or replace function public.dashboard_top_clientes(p_limite int default 5)
returns table(cliente_id int, nombre text, total numeric)
language sql
stable
as $$
  select v.cliente_id, c.nombre, sum(v.total)::numeric as total
  from ventas v
  left join clientes c on c.id = v.cliente_id
  where v.cliente_id is not null
  group by v.cliente_id, c.nombre
  order by sum(v.total) desc
  limit p_limite;
$$;

grant execute on function public.dashboard_top_clientes(int) to authenticated;
