export interface PromocionAplicable {
  id: number;
  nombre: string;
  producto_id: number | null;
  tipo: "porcentaje" | "monto";
  valor: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
}

function estaVigente(promo: PromocionAplicable): boolean {
  const ahora = Date.now();

  if (promo.fecha_inicio && ahora < new Date(promo.fecha_inicio).getTime()) {
    return false;
  }

  if (promo.fecha_fin && ahora > new Date(promo.fecha_fin).getTime()) {
    return false;
  }

  return true;
}

// Busca la promoción activa y vigente que aplica a un producto —
// prioriza una promoción específica del producto sobre una general
// (producto_id null = aplica a todos).
export function obtenerPromocionAplicable(
  productoId: number,
  promociones: PromocionAplicable[]
): PromocionAplicable | null {
  const vigentes = promociones.filter(estaVigente);

  const especifica = vigentes.find((p) => p.producto_id === productoId);
  if (especifica) return especifica;

  const general = vigentes.find((p) => p.producto_id === null);
  return general ?? null;
}

export function calcularPrecioConDescuento(
  precio: number,
  promo: PromocionAplicable | null
): number {
  if (!promo) return precio;

  if (promo.tipo === "porcentaje") {
    return Math.max(0, precio * (1 - promo.valor / 100));
  }

  return Math.max(0, precio - promo.valor);
}
