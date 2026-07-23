import * as XLSX from "xlsx";
import { Compra } from "./types";

export function exportarExcel(compras: Compra[]) {
  const datos = compras.map((compra) => ({
    Fecha: new Date(compra.fecha).toLocaleString(),
    Producto: compra.producto,
    Proveedor: compra.proveedor_nombre ?? "",
    Cantidad: Number(compra.cantidad),
    // costo_unitario/total son numeric en Postgres — Supabase los
    // devuelve como string. Sin convertir, json_to_sheet los escribe
    // como texto en la hoja (alineados a la izquierda) y =SUMA(...)
    // sobre esa columna da 0 en vez del total real.
    "Costo unitario": Number(compra.costo_unitario),
    Total: Number(compra.total),
    Nota: compra.nota ?? "",
  }));

  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Compras");
  XLSX.writeFile(libro, "Compras.xlsx");
}
