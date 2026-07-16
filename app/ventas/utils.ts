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

export function formatoMoneda(
  valor: number
) {
  return `$${valor.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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