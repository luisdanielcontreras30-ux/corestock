export type Plan = "free" | "plus";

// Rutas exclusivas de CoreStock Plus+ — coinciden con las claves de
// sección/ítem en lib/navegacion.ts. Todo lo que no está en esta lista
// (Ventas, Productos, Gráficas, Caja, Catálogo en Línea, Ajustes de
// Stock, Alertas, Clientes) es gratis.
export const RUTAS_PLUS = [
  "/compras",
  "/proveedores",
  "/cotizaciones",
  "/facturas",
  "/facturas-globales",
  "/fabricacion",
  "/traspasos",
  "/conciliaciones",
  "/cortes-historicos",
  "/portal-clientes",
  "/asistente",
  "/promociones",
] as const;

export function esRutaPlus(ruta: string): boolean {
  return RUTAS_PLUS.some((r) => ruta === r || ruta.startsWith(`${r}/`));
}
