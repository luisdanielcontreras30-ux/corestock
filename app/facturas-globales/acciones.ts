import { supabase } from "../../lib/supabase";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { FacturaGlobal } from "./types";

export async function cargarFacturasGlobales() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [] as FacturaGlobal[];
  }

  const { data, error } = await supabase
    .from("facturas_globales")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as FacturaGlobal[];
}

// Suma todas las ventas dentro del rango de fechas y guarda un resumen
// (snapshot) — no modifica ni "marca" las ventas originales.
export async function generarFacturaGlobal(
  fechaInicioStr: string,
  fechaFinStr: string,
  nota: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const fechaInicio = new Date(`${fechaInicioStr}T00:00:00`);
  const fechaFin = new Date(`${fechaFinStr}T23:59:59`);

  const { data: ventas, error: errorVentas } = await supabase
    .from("ventas")
    .select("total")
    .gte("fecha", fechaInicio.toISOString())
    .lte("fecha", fechaFin.toISOString());

  if (errorVentas) {
    throw errorVentas;
  }

  const cantidadVentas = ventas?.length ?? 0;

  if (cantidadVentas === 0) {
    // Mensaje sin traducir a propósito: este archivo no tiene acceso al
    // idioma activo (no es un componente). page.tsx reconoce este texto
    // exacto y muestra la clave i18n correspondiente en su lugar.
    throw new Error("SIN_VENTAS_EN_RANGO");
  }

  const total = (ventas ?? []).reduce((sum, v) => sum + Number(v.total), 0);
  const negocioId = await obtenerNegocioId(user.id);

  const { error } = await supabase.from("facturas_globales").insert({
    fecha_inicio: fechaInicio.toISOString(),
    fecha_fin: fechaFin.toISOString(),
    cantidad_ventas: cantidadVentas,
    total,
    nota: nota.trim() || null,
    user_id: negocioId,
  });

  if (error) {
    throw error;
  }
}

export async function eliminarFacturaGlobal(id: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { error } = await supabase
    .from("facturas_globales")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}
