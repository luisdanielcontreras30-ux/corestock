import { supabase } from "@/lib/supabase";
import { VentaCruda } from "./types";

export async function obtenerDatosGraficas(): Promise<VentaCruda[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { data: ventas, error } = await supabase
    .from("ventas")
    .select("*")
    .order("fecha", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  const listaVentas = ventas ?? [];

  return listaVentas.map((venta) => ({
    fecha: venta.fecha,
    producto:
      venta.producto && venta.producto.trim() !== ""
        ? venta.producto
        : "Sin nombre",
    cantidad: Number(venta.cantidad) || 0,
    total: Number(venta.total) || 0,
  }));
}
