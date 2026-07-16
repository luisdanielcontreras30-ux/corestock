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
//
// El chequeo de "no sacar más de lo que hay en caja" y la inserción se
// hacen juntos, atómicamente, dentro de la función de Postgres
// registrar_movimiento_caja (ver supabase_caja_atomico.sql) — así dos
// salidas registradas al mismo tiempo no pueden ambas leer el mismo
// saldo "viejo" antes de que ninguna termine de escribir.
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

  const { error } = await supabase.rpc("registrar_movimiento_caja", {
    p_tipo: tipo,
    p_monto: monto,
    p_motivo: motivo.trim() || null,
    p_monto_esperado: extra?.montoEsperado ?? null,
    p_diferencia: extra?.diferencia ?? null,
  });

  if (error) {
    if (error.message?.includes("SALDO_INSUFICIENTE")) {
      throw new Error("SALDO_INSUFICIENTE");
    }
    throw error;
  }
}
