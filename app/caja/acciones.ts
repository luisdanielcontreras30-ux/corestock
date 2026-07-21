import { supabase } from "../../lib/supabase";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { MovimientoCaja, TipoMovimientoCaja } from "./types";
import { db, generarUuid, esFalloDeRed } from "../../lib/db";

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
    .eq("tipo", "cierre")
    .order("fecha", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as MovimientoCaja[];
}

export function calcularSaldo(movimientos: MovimientoCaja[]): number {
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
  extra?: { montoEsperado?: number; diferencia?: number },
  // Presente solo cuando el movimiento viene de la cola offline (ver
  // lib/sync.ts) — llave de idempotencia, ver el comentario homólogo
  // en registrarVenta() (app/ventas/acciones.ts).
  uuid?: string
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
    p_uuid: uuid ?? null,
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

  const negocioId = await obtenerNegocioId(user.id);

  if (uuid) {
    const { data: existente, error: errorExistente } = await supabase
      .from("caja_movimientos")
      .select("id")
      .eq("uuid", uuid)
      .maybeSingle();

    if (errorExistente) throw errorExistente;
    if (existente) return;
  }

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
    uuid: uuid ?? null,
    user_id: negocioId,
  });

  if (errorInsertar) {
    throw errorInsertar;
  }
}

// Punto de entrada que usa la pantalla de Caja: decide entre escribir
// directo (con conexión) o encolar en IndexedDB (sin conexión) para
// que lib/sync.ts lo reintente contra registrarMovimiento() de verdad
// en cuanto vuelva Internet. No se valida el saldo de forma optimista
// sin conexión — el chequeo real y atómico ("no sacar más de lo que
// hay") ocurre al sincronizar, y si no alcanza el movimiento queda
// marcado "error" para revisión en vez de aceptarse con un saldo
// inventado.
export async function registrarMovimientoOffline(
  tipo: TipoMovimientoCaja,
  monto: number,
  motivo: string,
  userId: string,
  extra?: { montoEsperado?: number; diferencia?: number }
): Promise<{ encoladoOffline: boolean }> {
  // El uuid se genera antes de intentar, con o sin conexión: si el
  // intento en línea falla por red después de que el insert ya se
  // haya alcanzado a hacer del lado del servidor (la respuesta nunca
  // llegó al navegador), el mismo uuid hace que el reintento desde la
  // cola offline (lib/sync.ts) no duplique el movimiento.
  const uuid = generarUuid();

  if (navigator.onLine) {
    try {
      await registrarMovimiento(tipo, monto, motivo, extra, uuid);
      return { encoladoOffline: false };
    } catch (error) {
      // Solo se encola si de verdad fue un problema de red — un
      // rechazo real del servidor (ej. SALDO_INSUFICIENTE) debe seguir
      // mostrándose como error, nunca perderse en la cola offline.
      if (!esFalloDeRed(error)) {
        throw error;
      }
    }
  }

  await db.caja_pendientes.add({
    uuid,
    tipo,
    monto,
    motivo: motivo.trim() || null,
    monto_esperado: extra?.montoEsperado ?? null,
    diferencia: extra?.diferencia ?? null,
    creado_en: new Date().toISOString(),
    estado: "pendiente",
    error: null,
    user_id: userId,
  });

  return { encoladoOffline: true };
}
