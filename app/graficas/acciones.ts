import { supabase } from "@/lib/supabase";
import { VentaCruda } from "./types";

export async function obtenerDatosGraficas(): Promise<VentaCruda[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  // El período más amplio que se puede elegir es "anual", comparado
  // contra el año inmediatamente anterior (ver filtrarPorPeriodo en
  // utils.ts) — nada en esta pantalla mira más atrás que eso. Sin este
  // filtro se traía la tabla completa de ventas desde el primer día,
  // el mismo problema que ya se arregló en el Dashboard.
  const inicioAnioAnterior = new Date(new Date().getFullYear() - 1, 0, 1).toISOString();

  const { data: ventas, error } = await supabase
    .from("ventas")
    .select("*")
    .gte("fecha", inicioAnioAnterior)
    .order("fecha", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  const listaVentas = ventas ?? [];

  return listaVentas.map((venta) => ({
    fecha: venta.fecha,
    producto:
      venta.producto && venta.producto.trim() !== ""
        ? venta.producto
        : "Sin nombre",
    cantidad: Number(venta.cantidad) || 0,
    total: Number(venta.total) || 0,
  }));
}

// Trabajos de Servicios ya cobrados, en la misma forma que VentaCruda
// para poder sumarlos a los ingresos con las mismas funciones de
// utils.ts — pero con producto vacío y cantidad 0 para que NUNCA
// entren a "Top productos" ni a "Productos vendidos" (una fila de
// servicio no es un producto). Solo se combinan con las ventas para el
// KPI de ingresos y la gráfica de tendencia; el resto de las tarjetas
// (total de ventas, productos vendidos, venta promedio) se calculan
// aparte, solo con ventas.
//
// Tolerante a que la tabla no exista todavía (falta correr
// supabase_servicios.sql): en ese caso devuelve un arreglo vacío en
// vez de romper toda la pantalla de Gráficas.
export async function obtenerIngresosServicios(): Promise<VentaCruda[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    // fecha_cobro (cuándo se cobró de verdad), no fecha (cuándo fue el
    // trabajo) — ver supabase_servicios_fecha_cobro.sql. Se cae a
    // "fecha" solo para trabajos marcados "cobrado" antes de que
    // existiera esa columna.
    const { data: servicios, error } = await supabase
      .from("servicios_trabajos")
      .select("fecha, fecha_cobro, precio")
      .eq("estado", "cobrado")
      .order("fecha", { ascending: true });

    if (error) throw error;

    return (servicios ?? []).map((s) => ({
      fecha: (s.fecha_cobro as string | null) ?? (s.fecha as string),
      producto: "",
      cantidad: 0,
      total: Number(s.precio) || 0,
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
}
