-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- Habilita Row Level Security (RLS) en todas las tablas públicas y
-- agrega la política "cada quien ve/edita solo lo suyo" en las tablas
-- que la app usa activamente. Es seguro volver a correrlo (idempotente).
--
-- Sin esto, cualquier persona en internet puede leer y modificar los
-- datos de estas tablas usando la anon key pública, sin iniciar sesión.

do $$
begin
  if to_regclass('public.productos') is not null then
    execute 'alter table public.productos enable row level security';
    execute 'drop policy if exists "productos_por_dueno" on public.productos';
    execute 'create policy "productos_por_dueno" on public.productos for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)';
  end if;
  if to_regclass('public.ventas') is not null then
    execute 'alter table public.ventas enable row level security';
    execute 'drop policy if exists "ventas_por_dueno" on public.ventas';
    execute 'create policy "ventas_por_dueno" on public.ventas for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)';
  end if;
  if to_regclass('public.clientes') is not null then
    execute 'alter table public.clientes enable row level security';
    execute 'drop policy if exists "clientes_por_dueno" on public.clientes';
    execute 'create policy "clientes_por_dueno" on public.clientes for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)';
  end if;
  if to_regclass('public.proveedores') is not null then
    execute 'alter table public.proveedores enable row level security';
    execute 'drop policy if exists "proveedores_por_dueno" on public.proveedores';
    execute 'create policy "proveedores_por_dueno" on public.proveedores for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)';
  end if;
  if to_regclass('public.empresa_config') is not null then
    execute 'alter table public.empresa_config enable row level security';
    execute 'drop policy if exists "empresa_config_por_dueno" on public.empresa_config';
    execute 'create policy "empresa_config_por_dueno" on public.empresa_config for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)';
  end if;
  if to_regclass('public.miembros_equipo') is not null then
    execute 'alter table public.miembros_equipo enable row level security';
    execute 'drop policy if exists "miembros_equipo_por_dueno" on public.miembros_equipo';
    execute 'create policy "miembros_equipo_por_dueno" on public.miembros_equipo for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)';
  end if;
end $$;

-- Tablas que la app todavía no usa (quedaron creadas de antes, sin RLS).
-- Se cierran por completo hasta que se construya cada módulo con su
-- propia política real. "compras" se excluye de esta lista porque ya
-- tiene su propia migración (supabase_compras.sql) con política real,
-- desde que el módulo de Compras se volvió funcional.
do $$
begin
  if to_regclass('public.compra_detalle') is not null then execute 'alter table public.compra_detalle enable row level security'; end if;
  if to_regclass('public.venta_detalle') is not null then execute 'alter table public.venta_detalle enable row level security'; end if;
  if to_regclass('public.recetas') is not null then execute 'alter table public.recetas enable row level security'; end if;
  if to_regclass('public.materias_primas') is not null then execute 'alter table public.materias_primas enable row level security'; end if;
  if to_regclass('public.distribuidores') is not null then execute 'alter table public.distribuidores enable row level security'; end if;
end $$;
