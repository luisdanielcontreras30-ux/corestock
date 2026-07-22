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

  // Con .select(): sin esto, si RLS bloquea el update (falta el
  // permiso "editar_ventas" — ver supabase_permisos_miembros.sql) no
  // se reporta ningún error ni fila afectada, y el código de abajo
  // seguía como si hubiera tenido éxito — mostraba "cobrado" en verde
  // y la venta reaparecía como pendiente al recargar.
  const { data, error } = await supabase
    .from("ventas")
    .update({ cobrado: true })
    .eq("id", ventaId)
    .eq("metodo_pago", "prestamo")
    .select("id");

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error("NO_ACTUALIZADO");
  }
}
