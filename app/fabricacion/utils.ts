import * as XLSX from "xlsx";
import { Produccion } from "./types";

export function exportarExcel(producciones: Produccion[]) {
  const datos = producciones.map((p) => ({
    Fecha: new Date(p.fecha).toLocaleString(),
    Producto: p.producto_nombre,
    Cantidad: Number(p.cantidad),
  }));

  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Producciones");
  XLSX.writeFile(libro, "Producciones.xlsx");
}
