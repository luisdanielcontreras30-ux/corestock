// Ordena una lista de productos por categoría (alfabético, con "sin
// categoría" al final) — para que un <SelectorPersonalizado> con la
// prop "grupo" por opción muestre categorías contiguas en vez de
// mezcladas, ya que agrupa asumiendo que las opciones del mismo grupo
// vienen seguidas. Mismo criterio que ya usa Productos para su tabla.
export function ordenarPorCategoria<T extends { categoria: string | null }>(
  items: T[],
  sinCategoriaTexto: string
): T[] {
  function etiqueta(item: T): string {
    return item.categoria?.trim() ? item.categoria.trim() : sinCategoriaTexto;
  }

  return [...items].sort((a, b) => {
    const etiquetaA = etiqueta(a);
    const etiquetaB = etiqueta(b);

    if (etiquetaA === sinCategoriaTexto && etiquetaB !== sinCategoriaTexto) return 1;
    if (etiquetaB === sinCategoriaTexto && etiquetaA !== sinCategoriaTexto) return -1;
    if (etiquetaA !== etiquetaB) return etiquetaA.localeCompare(etiquetaB);

    // Mismo grupo — se deja el orden que ya traía (alfabético por
    // nombre, según la consulta), ya que Array.prototype.sort es
    // estable.
    return 0;
  });
}
