import { supabase } from "../../lib/supabase";
import { MovimientoCaja, TipoMovimientoCaja } from "./types";

export async function cargarMovimientos() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [] as MovimientoCaja[];
  }

  const { data, error } = await supabase
    .from("caja_movimientos")
    .select("*")
    .eq("user_id", user.id)
    .order("fecha", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as MovimientoCaja[];
}

// Solo los cierres — lo usa la página de Cortes Históricos.
export async function cargarCierres() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [] as MovimientoCaja[];
  }

  const { data, error } = await supabase
    .from("caja_movimientos")
    .select("*")
    .eq("user_id", user.id)
    .eq("tipo", "cierre")
    .order("fecha", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as MovimientoCaja[];
}

// Bitácora de solo inserción — no hay función para editar/borrar
// movimientos, a propósito: una caja real no se "corrige" retroactivo.
export async function registrarMovimiento(
  tipo: TipoMovimientoCaja,
  monto: number,
  motivo: string,
  extra?: { montoEsperado?: number; diferencia?: number }
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { error } = await supabase.from("caja_movimientos").insert({
    fecha: new Date().toISOString(),
    tipo,
    monto,
    motivo: motivo.trim() || null,
    monto_esperado: extra?.montoEsperado ?? null,
    diferencia: extra?.diferencia ?? null,
    user_id: user.id,
  });

  if (error) {
    throw error;
  }
}
