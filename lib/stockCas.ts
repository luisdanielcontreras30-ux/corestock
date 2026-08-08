import { supabase } from "./supabase";

const MAX_INTENTOS = 5;

// Ajusta el stock de un producto sumando `delta` (puede ser negativo)
// con un update "compare-and-swap": relee el stock justo antes de
// escribir e incluye ese valor en el WHERE, así que si otra operación
// concurrente (una venta, una compra, otro borrado) ya lo cambió, el
// update afecta 0 filas en vez de pisar silenciosamente ese cambio.
// Reintenta unas cuantas veces con el valor fresco antes de rendirse.
//
// negocioId tiene que ser el id del NEGOCIO dueño del producto, no el
// auth.uid() de quien llama — para un miembro del equipo son distintos
// (ver lib/negocioActual.ts). Si aquí se pasara por error el auth.uid()
// propio de un miembro, la fila nunca se encontraría y la función
// devolvería "true" igual (ver el "no hay stock que ajustar" de abajo),
// como si el ajuste hubiera funcionado sin haber tocado nada.
export async function ajustarStockConCas(
  productoId: number,
  negocioId: string,
  delta: number,
  opciones: { minimoCero?: boolean; tabla?: "productos" | "materias_primas" } = {}
): Promise<boolean> {
  const tabla = opciones.tabla ?? "productos";

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const { data: fila, error: errorLectura } = await supabase
      .from(tabla)
      .select("stock")
      .eq("id", productoId)
      .eq("user_id", negocioId)
      .maybeSingle();

    if (errorLectura) throw errorLectura;

    // La fila ya no existe (se borró aparte) — no hay stock que
    // ajustar, se considera resuelto.
    if (!fila) return true;

    let nuevoStock = fila.stock + delta;
    if (opciones.minimoCero) nuevoStock = Math.max(0, nuevoStock);

    const { data: actualizado, error: errorStock } = await supabase
      .from(tabla)
      .update({ stock: nuevoStock })
      .eq("id", productoId)
      .eq("user_id", negocioId)
      .eq("stock", fila.stock)
      .select("id");

    if (errorStock) throw errorStock;
    if (actualizado && actualizado.length > 0) return true;
  }

  return false;
}
