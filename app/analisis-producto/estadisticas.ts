import { EstadisticasCategoria, Frecuencia, ProductoCategoria, PuntoMes, VentaCategoria } from "./types";

// Ventana de historial de ventas que se usa para estimar el potencial
// de una categoría — ni tan corta que un mes flojo distorsione el
// promedio, ni tan larga que diluya cambios recientes de demanda.
const MESES_HISTORIAL = 6;

const MESES_ABREV = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function promedio(valores: number[]): number {
  return valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
}

function claveMes(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

// Últimos MESES_HISTORIAL meses en orden cronológico, con 0 unidades en
// los meses sin ventas — así la gráfica siempre cubre el mismo tramo de
// tiempo sin importar si hubo ventas en todos los meses.
function construirSerieMeses(porMes: Map<string, number>): PuntoMes[] {
  const puntos: PuntoMes[] = [];
  const hoy = new Date();

  for (let i = MESES_HISTORIAL - 1; i >= 0; i--) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    puntos.push({ mes: MESES_ABREV[fecha.getMonth()], unidades: porMes.get(claveMes(fecha)) ?? 0 });
  }

  return puntos;
}

// Umbrales informativos (no una regla de negocio estricta): cuántas
// ventas distintas por mes, en promedio, tiene la categoría completa.
function clasificarFrecuencia(ventasPorMes: number): Frecuencia {
  if (ventasPorMes >= 10) return "alta";
  if (ventasPorMes >= 3) return "media";
  return "baja";
}

function categoriaVacia(categoria: string): EstadisticasCategoria {
  return {
    categoria,
    tieneProductos: false,
    tieneVentas: false,
    productosEnCategoria: 0,
    unidadesPromedioMes: 0,
    precioPromedio: 0,
    margenPromedioPct: null,
    ingresosPromedioMes: 0,
    gananciaEstimadaMensual: 0,
    frecuencia: null,
    ventasPorMes: construirSerieMeses(new Map()),
  };
}

// La IA puede devolver "bebidas" cuando el negocio ya guarda esa misma
// categoría como "Bebidas" — sin este match no distinguiendo
// mayúsculas/espacios, una categoría que en realidad ya existe se
// trataría como nueva y el análisis perdería todo el historial real.
export function encontrarCategoriaExistente(
  categoriaDetectada: string,
  productos: ProductoCategoria[]
): string | null {
  const normalizada = categoriaDetectada.trim().toLowerCase();
  const encontrada = productos.find((p) => (p.categoria ?? "").trim().toLowerCase() === normalizada);
  return encontrada ? (encontrada.categoria as string) : null;
}

export function calcularEstadisticasCategoria(
  categoria: string,
  productos: ProductoCategoria[],
  ventas: VentaCategoria[]
): EstadisticasCategoria {
  const normalizada = categoria.trim().toLowerCase();
  const productosCategoria = productos.filter((p) => (p.categoria ?? "").trim().toLowerCase() === normalizada);

  if (productosCategoria.length === 0) {
    return categoriaVacia(categoria);
  }

  const precioPromedio = promedio(productosCategoria.map((p) => p.precio_venta));
  // costo=0 no distingue "el negocio no capturó el costo" de "este
  // producto de verdad no cuesta nada" — guardar() en Productos escribe
  // 0 (nunca null) cuando el campo se deja vacío, así que tratar 0 como
  // costo real infla el margen a 100% para cualquier producto sin costo
  // capturado. Se excluye igual que el caso null.
  const margenes = productosCategoria
    .filter((p) => p.costo != null && p.costo > 0 && p.precio_venta > 0)
    .map((p) => (p.precio_venta - (p.costo as number)) / p.precio_venta);
  const margenPromedioPct = margenes.length > 0 ? promedio(margenes) : null;

  const idsCategoria = new Set(productosCategoria.map((p) => p.id));
  const ventasCategoria = ventas.filter((v) => idsCategoria.has(v.producto_id));

  if (ventasCategoria.length === 0) {
    return {
      ...categoriaVacia(categoria),
      tieneProductos: true,
      productosEnCategoria: productosCategoria.length,
      precioPromedio,
      margenPromedioPct,
    };
  }

  const porMesUnidades = new Map<string, number>();

  for (const v of ventasCategoria) {
    const clave = claveMes(new Date(v.fecha));
    porMesUnidades.set(clave, (porMesUnidades.get(clave) ?? 0) + v.cantidad);
  }

  // Se divide entre la ventana fija (MESES_HISTORIAL), no entre los
  // meses que sí tuvieron venta — dividir solo entre meses con datos
  // convertía una venta puntual en un solo mes en un "promedio
  // mensual" igual de alto que si se vendiera todos los meses,
  // contradiciendo la propia gráfica de barras (que sí muestra los
  // meses sin venta en cero).
  const unidadesPromedioMes = ventasCategoria.reduce((acc, v) => acc + v.cantidad, 0) / MESES_HISTORIAL;
  const ingresosPromedioMes = ventasCategoria.reduce((acc, v) => acc + v.total, 0) / MESES_HISTORIAL;
  const gananciaEstimadaMensual = margenPromedioPct != null ? ingresosPromedioMes * margenPromedioPct : 0;

  return {
    categoria,
    tieneProductos: true,
    tieneVentas: true,
    productosEnCategoria: productosCategoria.length,
    unidadesPromedioMes,
    precioPromedio,
    margenPromedioPct,
    ingresosPromedioMes,
    gananciaEstimadaMensual,
    frecuencia: clasificarFrecuencia(ventasCategoria.length / MESES_HISTORIAL),
    ventasPorMes: construirSerieMeses(porMesUnidades),
  };
}
