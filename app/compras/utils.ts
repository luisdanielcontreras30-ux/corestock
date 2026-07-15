import * as XLSX from "xlsx";
import { Compra } from "./types";

export function exportarExcel(compras: Compra[]) {
  const datos = compras.map((compra) => ({
    Fecha: new Date(compra.fecha).toLocaleString(),
    Producto: compra.producto,
    Proveedor: compra.proveedor_nombre ?? "",
    Cantidad: compra.cantidad,
    "Costo unitario": compra.costo_unitario,
    Total: compra.total,
    Nota: compra.nota ?? "",
  }));

  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Compras");
  XLSX.writeFile(libro, "Compras.xlsx");
}
