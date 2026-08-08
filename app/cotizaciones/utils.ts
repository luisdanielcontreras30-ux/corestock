import * as XLSX from "xlsx";
import { Cotizacion } from "./types";

// Una fila por CONCEPTO, no por cotización. Con cotizaciones de varias
// líneas, exportar solo el resumen escondería justo lo que se quiere
// revisar en la hoja de cálculo: qué se cotizó y a cuánto.
//
// El folio se repite en cada fila del mismo documento, que es lo que
// permite agrupar o filtrar por cotización dentro de Excel.
export function exportarExcel(cotizaciones: Cotizacion[]) {
  const datos = cotizaciones.flatMap((cotizacion) =>
    cotizacion.items.map((item) => ({
      Folio: `COT-${String(cotizacion.id).padStart(6, "0")}`,
      Fecha: new Date(cotizacion.fecha).toLocaleString(),
      Cliente: cotizacion.cliente_nombre ?? "",
      Tipo: item.tipo,
      Concepto: item.descripcion,
      Cantidad: Number(item.cantidad),
      // precio_unitario/total son numeric en Postgres — Supabase los
      // devuelve como string. Sin convertir, json_to_sheet los escribe
      // como texto en la hoja y =SUMA(...) sobre esa columna da 0.
      "Precio unitario": Number(item.precio_unitario),
      Importe: Number(item.cantidad) * Number(item.precio_unitario),
      "Total cotización": Number(cotizacion.total),
      Estado: cotizacion.estado,
      Nota: cotizacion.nota ?? "",
    }))
  );

  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Cotizaciones");
  XLSX.writeFile(libro, "Cotizaciones.xlsx");
}
