import { supabase } from "../../lib/supabase";
import { ProductoCategoria, VentaCategoria } from "./types";

const MESES_HISTORIAL_VENTAS = 6;

// Trae de una sola vez todo lo que hace falta para analizar cualquier
// categoría (productos + su historial de ventas reciente) — el cálculo
// por categoría se hace después en memoria (ver estadisticas.ts), así
// que analizar varias fotos seguidas no dispara una consulta nueva
// por cada una.
export async function cargarDatosAnalisis(): Promise<{
  productos: ProductoCategoria[];
  ventas: VentaCategoria[];
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { productos: [], ventas: [] };
  }

  const desde = new Date();
  desde.setMonth(desde.getMonth() - MESES_HISTORIAL_VENTAS);
  desde.setDate(1);
  desde.setHours(0, 0, 0, 0);

  const [
    { data: productos, error: errorProductos },
    { data: ventas, error: errorVentas },
  ] = await Promise.all([
    supabase.from("productos").select("id, categoria, precio_venta, costo"),
    supabase
      .from("ventas")
      .select("fecha, cantidad, total, producto_id")
      .gte("fecha", desde.toISOString()),
  ]);

  if (errorProductos) throw errorProductos;
  if (errorVentas) throw errorVentas;

  return {
    productos: (productos ?? []) as ProductoCategoria[],
    ventas: (ventas ?? []) as VentaCategoria[],
  };
}
