import { supabase } from "../../lib/supabase";
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
    .eq("user_id", user.id)
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

  const { error } = await supabase.from("conciliaciones").insert({
    fecha: new Date().toISOString(),
    descripcion: descripcion.trim(),
    tipo,
    monto,
    conciliado: false,
    user_id: user.id,
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
    .eq("id", id)
    .eq("user_id", user.id);

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
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
}
