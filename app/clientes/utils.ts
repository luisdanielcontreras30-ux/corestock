import * as XLSX from "xlsx";
import { ClienteConResumen, estrellasPorCompras } from "./types";

export function exportarExcel(clientes: ClienteConResumen[]) {
  const datos = clientes.map((c) => ({
    Nombre: c.nombre,
    Teléfono: c.telefono ?? "",
    Correo: c.correo ?? "",
    Categoría: c.categoria ?? "",
    Calificación: estrellasPorCompras(c.compras) ?? "",
    Compras: Number(c.compras),
    // total_gastado es numeric en Postgres — Supabase lo devuelve como
    // string. Sin convertir, json_to_sheet lo escribe como texto en la
    // hoja y =SUMA(...) sobre esa columna da 0 en vez del total real.
    "Total gastado": Number(c.totalGastado),
    Notas: c.notas ?? "",
  }));

  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Clientes");
  XLSX.writeFile(libro, "Clientes.xlsx");
}
