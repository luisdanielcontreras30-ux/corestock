import { supabase } from "./supabase";
import { Miembro } from "../app/configuracion/types";

// Única fuente de verdad para la clave de sessionStorage donde se
// guarda qué miembro del equipo está activo — components/
// MiembroActivoProvider.tsx la usa para el estado de React que oculta
// botones, y este archivo la reusa para resolver negocioId sin
// depender de contexto de React (hace falta desde acciones.ts, que no
// son componentes).
export const CLAVE_STORAGE_MIEMBRO_ACTIVO = "corestock_miembro_activo";

export interface DatosMiembroGuardado {
  userId: string;
  negocioId: string;
  miembro: Miembro;
}

export function leerMiembroActivoGuardado(): DatosMiembroGuardado | null {
  try {
    const guardado = sessionStorage.getItem(CLAVE_STORAGE_MIEMBRO_ACTIVO);
    return guardado ? (JSON.parse(guardado) as DatosMiembroGuardado) : null;
  } catch {
    return null;
  }
}

// Id del NEGOCIO al que pertenecen los datos que se están por leer o
// escribir — no confundir con el auth.uid() de la sesión actual: para
// un miembro del equipo son distintos desde que cada uno tiene su
// propia identidad de Supabase (ver supabase_permisos_miembros.sql).
// Sin dueño activo (sesión del propio dueño), coinciden.
export async function obtenerNegocioId(): Promise<string> {
  const datos = leerMiembroActivoGuardado();
  if (datos) return datos.negocioId;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  return user.id;
}
