import { supabase } from "../../lib/supabase";
import { VentaFiada } from "./types";

export async function cargarPendientes(): Promise<VentaFiada[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("ventas")
    .select("id, fecha, producto, cantidad, total, cliente_id, clientes(nombre)")
    .eq("metodo_pago", "prestamo")
    .eq("cobrado", false)
    .order("fecha", { ascending: false });

  if (error) throw error;

  return (data ?? []) as unknown as VentaFiada[];
}

export async function marcarComoCobrado(ventaId: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { error } = await supabase
    .from("ventas")
    .update({ cobrado: true })
    .eq("id", ventaId)
    .eq("metodo_pago", "prestamo");

  if (error) {
    throw error;
  }
}
