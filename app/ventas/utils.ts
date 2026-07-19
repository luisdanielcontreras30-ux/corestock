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

export function buscarVentas(
  ventas: Venta[],
  texto: string
) {
  if (!texto.trim()) return ventas;

  return ventas.filter((venta) =>
    venta.producto
      .toLowerCase()
      .includes(texto.toLowerCase())
  );
}