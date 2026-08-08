export type Plan = "free" | "plus";

// Interruptor temporal: mientras CoreStock Plus+ está en periodo de
// prueba gratuita, los módulos Plus+ quedan abiertos para todos (solo
// conservan la etiqueta "Plus+" informativa) y no se ofrece la compra.
// Volver a poner esto en `true` restaura el candado y el botón normal.
export const BLOQUEO_PLUS_ACTIVO = false;

// Rutas exclusivas de CoreStock Plus+ — coinciden con las claves de
// sección/ítem en lib/navegacion.ts. Todo lo que no está en esta lista
// (Ventas, Productos, Gráficas, Caja, Catálogo en Línea, Ajustes de
// Stock, Alertas, Clientes) es gratis.
export const RUTAS_PLUS = [
  "/analisis-producto",
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
  "/whatsapp",
] as const;

export function esRutaPlus(ruta: string): boolean {
  return RUTAS_PLUS.some((r) => ruta === r || ruta.startsWith(`${r}/`));
}
