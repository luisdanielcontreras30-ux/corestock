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

function calcularSaldo(movimientos: MovimientoCaja[]): number {
  let saldo = 0;
  for (const m of movimientos) {
    if (m.tipo === "apertura") saldo = Number(m.monto);
    else if (m.tipo === "entrada") saldo += Number(m.monto);
    else if (m.tipo === "salida") saldo -= Number(m.monto);
  }
  return saldo;
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

  if (!error) return;

  if (error.message?.includes("SALDO_INSUFICIENTE")) {
    throw new Error("SALDO_INSUFICIENTE");
  }

  // La función registrar_movimiento_caja (supabase_caja_atomico.sql)
  // todavía no existe en este proyecto de Supabase — se usa el
  // registro directo como respaldo para que Caja no se quede sin
  // funcionar mientras se corre esa migración. Sin la función, el
  // chequeo de saldo en "salida" deja de ser atómico (mismo
  // comportamiento que había antes de agregar esa protección).
  const funcionInexistente =
    error.code === "PGRST202" ||
    error.message?.toLowerCase().includes("could not find the function");

  if (!funcionInexistente) {
    throw error;
  }

  console.warn(
    "registrar_movimiento_caja no existe todavía en Supabase — usando registro directo. Corre supabase_caja_atomico.sql en el SQL Editor para activar la protección atómica."
  );

  if (tipo === "salida") {
    const movimientos = await cargarMovimientos();
    if (monto > calcularSaldo(movimientos)) {
      throw new Error("SALDO_INSUFICIENTE");
    }
  }

  const { error: errorInsertar } = await supabase.from("caja_movimientos").insert({
    fecha: new Date().toISOString(),
    tipo,
    monto,
    motivo: motivo.trim() || null,
    monto_esperado: extra?.montoEsperado ?? null,
    diferencia: extra?.diferencia ?? null,
    user_id: user.id,
  });

  if (errorInsertar) {
    throw errorInsertar;
  }
}
