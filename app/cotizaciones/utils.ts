import * as XLSX from "xlsx";
import { Cotizacion } from "./types";

export function exportarExcel(cotizaciones: Cotizacion[]) {
  const datos = cotizaciones.map((cotizacion) => ({
    Fecha: new Date(cotizacion.fecha).toLocaleString(),
    Cliente: cotizacion.cliente_nombre ?? "",
    Producto: cotizacion.producto,
    Cantidad: Number(cotizacion.cantidad),
    // precio_unitario/total son numeric en Postgres — Supabase los
    // devuelve como string. Sin convertir, json_to_sheet los escribe
    // como texto en la hoja y =SUMA(...) sobre esa columna da 0.
    "Precio unitario": Number(cotizacion.precio_unitario),
    Total: Number(cotizacion.total),
    Estado: cotizacion.estado,
    Nota: cotizacion.nota ?? "",
  }));

  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Cotizaciones");
  XLSX.writeFile(libro, "Cotizaciones.xlsx");
}
