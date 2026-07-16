import { supabase } from "./supabase";

const MAX_INTENTOS = 5;

// Ajusta el stock de un producto sumando `delta` (puede ser negativo)
// con un update "compare-and-swap": relee el stock justo antes de
// escribir e incluye ese valor en el WHERE, así que si otra operación
// concurrente (una venta, una compra, otro borrado) ya lo cambió, el
// update afecta 0 filas en vez de pisar silenciosamente ese cambio.
// Reintenta unas cuantas veces con el valor fresco antes de rendirse.
export async function ajustarStockConCas(
  productoId: number,
  userId: string,
  delta: number,
  opciones: { minimoCero?: boolean } = {}
): Promise<boolean> {
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const { data: producto, error: errorLectura } = await supabase
      .from("productos")
      .select("stock")
      .eq("id", productoId)
      .eq("user_id", userId)
      .maybeSingle();

    if (errorLectura) throw errorLectura;

    // El producto ya no existe (se borró aparte) — no hay stock que
    // ajustar, se considera resuelto.
    if (!producto) return true;

    let nuevoStock = producto.stock + delta;
    if (opciones.minimoCero) nuevoStock = Math.max(0, nuevoStock);

    const { data: actualizado, error: errorStock } = await supabase
      .from("productos")
      .update({ stock: nuevoStock })
      .eq("id", productoId)
      .eq("user_id", userId)
      .eq("stock", producto.stock)
      .select("id");

    if (errorStock) throw errorStock;
    if (actualizado && actualizado.length > 0) return true;
  }

  return false;
}
