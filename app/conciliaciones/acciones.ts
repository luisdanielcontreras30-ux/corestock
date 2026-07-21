import { supabase } from "../../lib/supabase";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { MovimientoConciliacion, TipoMovimientoConciliacion } from "./types";

export async function cargarMovimientos() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [] as MovimientoConciliacion[];
  }

  const { data, error } = await supabase
    .from("conciliaciones")
    .select("*")
    .order("fecha", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as MovimientoConciliacion[];
}

export async function crearMovimiento(
  descripcion: string,
  tipo: TipoMovimientoConciliacion,
  monto: number
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const negocioId = await obtenerNegocioId(user.id);

  // El formulario (page.tsx) ya valida esto, pero se repite aquí porque
  // esta acción es exportada y podría llamarse directamente sin pasar
  // por él — mismo patrón que Compras/Devoluciones/Promociones.
  if (!descripcion.trim()) {
    throw new Error("Falta la descripción del movimiento.");
  }

  if (!Number.isFinite(monto) || monto <= 0) {
    throw new Error("El monto debe ser mayor a 0.");
  }

  const { error } = await supabase.from("conciliaciones").insert({
    fecha: new Date().toISOString(),
    descripcion: descripcion.trim(),
    tipo,
    monto,
    conciliado: false,
    user_id: negocioId,
  });

  if (error) {
    throw error;
  }
}

export async function alternarConciliado(id: number, conciliado: boolean) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { error } = await supabase
    .from("conciliaciones")
    .update({ conciliado })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function eliminarMovimiento(id: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { error } = await supabase
    .from("conciliaciones")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}
