-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- Portal de Clientes: cada cliente obtiene un enlace único (su
-- "token") para ver su propio historial de compras sin necesitar una
-- cuenta ni contraseña. Igual que en Catálogo en Línea, el único
-- acceso público a datos es una función SQL SECURITY DEFINER que
-- decide exactamente qué devolver — nombre del cliente y sus compras
-- — y solo cuando el token coincide exactamente. No se otorga ningún
-- permiso de lectura directo sobre "clientes" ni "ventas" a usuarios
-- anónimos.

alter table clientes add column if not exists token uuid not null default gen_random_uuid();

create unique index if not exists clientes_token_key on clientes (token);

create or replace function public.obtener_portal_cliente(p_token uuid)
returns table (
  cliente_nombre text,
  compras jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    c.nombre,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', v.id,
            'fecha', v.fecha,
            'producto', v.producto,
            'cantidad', v.cantidad,
            'precio', v.precio,
            'total', v.total
          )
          order by v.fecha desc
        )
        from ventas v
        where v.cliente_id = c.id and v.user_id = c.user_id
      ),
      '[]'::jsonb
    ) as compras
  from clientes c
  where c.token = p_token;
$$;

grant execute on function public.obtener_portal_cliente(uuid) to anon, authenticated;
