import { obtenerSupabaseAdmin } from "./supabaseAdmin";

// Espejo en TypeScript de public.resolver_negocio_id() (ver
// supabase_permisos_miembros.sql) — para rutas que ya usan el cliente
// admin (se saltan RLS), así que no pueden apoyarse en la función SQL
// dentro de una política. Dado el auth.uid() de quien llama, devuelve
// el id del NEGOCIO al que pertenece: si es un miembro del equipo con
// su propio auth_user_id, el id del dueño; si no aparece en
// miembros_equipo, se asume que la persona misma es la dueña.
export async function resolverNegocioId(authUid: string): Promise<string> {
  const admin = obtenerSupabaseAdmin();

  const { data, error } = await admin
    .from("miembros_equipo")
    .select("user_id")
    .eq("auth_user_id", authUid)
    .eq("activo", true)
    .maybeSingle();

  if (error) throw error;

  return (data?.user_id as string | undefined) ?? authUid;
}

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
