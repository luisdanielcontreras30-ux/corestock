import { obtenerSupabaseAdmin } from "./supabaseAdmin";

// Junto con el id del negocio, dice si quien llama es un miembro (no
// el dueño) y, si lo es, cuáles son sus permisos vigentes — para rutas
// que además de resolver el negocio necesitan exigir un permiso
// puntual (ej. "configuracion" para tocar facturación o miembros).
export async function resolverNegocioYPermisos(
  authUid: string
): Promise<{ negocioId: string; esMiembro: boolean; permisos: string[] }> {
  const admin = obtenerSupabaseAdmin();

  const { data, error } = await admin
    .from("miembros_equipo")
    .select("user_id, permisos")
    .eq("auth_user_id", authUid)
    .eq("activo", true)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return { negocioId: authUid, esMiembro: false, permisos: [] };
  }

  return {
    negocioId: data.user_id as string,
    esMiembro: true,
    permisos: (data.permisos as string[] | null) ?? [],
  };
}
