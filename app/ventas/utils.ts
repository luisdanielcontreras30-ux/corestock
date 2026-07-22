import * as XLSX from "xlsx";
import { Venta, MetodoPago } from "./types";

export const CLAVE_METODO_PAGO: Record<MetodoPago, string> = {
  efectivo: "ventas.metodo_efectivo",
  tarjeta: "ventas.metodo_tarjeta",
  transferencia: "ventas.metodo_transferencia",
  prestamo: "ventas.metodo_prestamo",
  otro: "ventas.metodo_otro",
};

export function exportarExcel(ventas: Venta[]) {
  const datos = ventas.map((venta) => ({
    Fecha: new Date(venta.fecha).toLocaleString(),
    Producto: venta.producto,
    Cantidad: venta.cantidad,
    Precio: venta.precio,
    Total: venta.total,
    "Metodo de pago": venta.metodo_pago ?? "efectivo",
  }));

  const hoja = XLSX.utils.json_to_sheet(datos);

  const libro = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    libro,
    hoja,
    "Ventas"
  );

  XLSX.writeFile(
    libro,
    "Ventas.xlsx"
  );
}

// toLocaleString pone el signo pegado a los dígitos ("-45.50"), así
// que armar el string directo daba "$-45.50" — el signo va antes del
// símbolo de moneda, no después.
function conSeparadores(valor: number): string {
  const signo = valor < 0 ? "-" : "";
  return `${signo}${Math.abs(valor).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatoMoneda(valor: number) {
  return `$${conSeparadores(valor)}`;
}

// Igual que formatoMoneda() pero sin el "$" — para plantillas de texto
// (ej. las respuestas del Asistente) que ya traen su propio "$" en el
// string traducido y solo necesitan el número con separadores de miles.
export function formatoNumeroMoneda(valor: number) {
  return conSeparadores(valor);
}

export function formatoFecha(
  fecha: string
) {
  return new Date(
    fecha
  ).toLocaleString();
}

export interface GrupoFecha<T> {
  etiqueta: string;
  items: T[];
}

// Agrupa una lista (se asume ya ordenada de más reciente a más
// antigua, como llega ventas.acciones.ts) en secciones por fecha —
// mismo criterio compartido por Ventas y Facturas, para que una lista
// larga se pueda escanear de un vistazo en vez de ser un bloque
// continuo de filas. Se evitó agregar un corte por "este mes" porque,
// cerca del día 1, ese rango puede quedar más reciente que el de
// "últimos 7 días" y desordenar los grupos.
export function agruparPorFecha<T>(
  items: T[],
  obtenerFecha: (item: T) => string,
  etiquetas: { hoy: string; ayer: string; ultimos7Dias: string; anteriores: string }
): GrupoFecha<T>[] {
  const ahora = new Date();
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const inicioAyer = new Date(inicioHoy);
  inicioAyer.setDate(inicioAyer.getDate() - 1);
  const inicioUltimos7Dias = new Date(inicioHoy);
  inicioUltimos7Dias.setDate(inicioUltimos7Dias.getDate() - 7);

  const grupos: GrupoFecha<T>[] = [
    { etiqueta: etiquetas.hoy, items: [] },
    { etiqueta: etiquetas.ayer, items: [] },
    { etiqueta: etiquetas.ultimos7Dias, items: [] },
    { etiqueta: etiquetas.anteriores, items: [] },
  ];

  for (const item of items) {
    const fecha = new Date(obtenerFecha(item));

    if (fecha >= inicioHoy) {
      grupos[0].items.push(item);
    } else if (fecha >= inicioAyer) {
      grupos[1].items.push(item);
    } else if (fecha >= inicioUltimos7Dias) {
      grupos[2].items.push(item);
    } else {
      grupos[3].items.push(item);
    }
  }

  return grupos.filter((grupo) => grupo.items.length > 0);
}