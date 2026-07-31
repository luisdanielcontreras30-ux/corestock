import * as XLSX from "xlsx";
import { ProveedorConResumen } from "./types";

export function exportarExcel(proveedores: ProveedorConResumen[]) {
  const datos = proveedores.map((p) => ({
    Nombre: p.nombre,
    Teléfono: p.telefono ?? "",
    Correo: p.correo ?? "",
    Categoría: p.categoria ?? "",
    Calificación: typeof p.calificacion === "number" ? p.calificacion : "",
    "Días de entrega": typeof p.dias_entrega === "number" ? p.dias_entrega : "",
    Compras: Number(p.compras),
    // total_gastado es numeric en Postgres — Supabase lo devuelve como
    // string. Sin convertir, json_to_sheet lo escribe como texto en la
    // hoja y =SUMA(...) sobre esa columna da 0 en vez del total real.
    "Total gastado": Number(p.totalGastado),
    Notas: p.notas ?? "",
  }));

  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Proveedores");
  XLSX.writeFile(libro, "Proveedores.xlsx");
}
