import { Miembro, Permiso } from "../app/configuracion/types";

// Lógica pura detrás de MiembroActivoProvider.puede() — separada del
// componente para poder probarla sin montar React. null = sesión del
// dueño de la cuenta (sin restricciones); un Miembro solo puede lo que
// esté en su lista de permisos.
export function tienePermiso(miembroActivo: Miembro | null, permiso: Permiso): boolean {
  if (!miembroActivo) return true;
  return miembroActivo.permisos.includes(permiso);
}
