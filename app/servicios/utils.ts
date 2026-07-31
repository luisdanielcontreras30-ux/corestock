import * as XLSX from "xlsx";
import { Trabajo } from "./types";

export function exportarExcel(trabajos: Trabajo[]) {
  const datos = trabajos.map((trab) => ({
    Fecha: new Date(trab.fecha).toLocaleString(),
    Cliente: trab.cliente_nombre,
    Servicio: trab.servicio,
    // precio es numeric en Postgres — Supabase lo devuelve como string.
    // Sin convertir, json_to_sheet lo escribe como texto en la hoja y
    // =SUMA(...) sobre esa columna da 0 en vez del total real.
    Precio: Number(trab.precio),
    Estado: trab.estado,
    Notas: trab.notas ?? "",
  }));

  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Servicios");
  XLSX.writeFile(libro, "Servicios.xlsx");
}
