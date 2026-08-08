import crypto from "crypto";
import { obtenerSupabaseAdmin } from "./supabaseAdmin";

const DOMINIO_SINTETICO = "miembros.corestock.internal";

// Correo interno, nunca enviado ni mostrado, usado solo como "email"
// de la cuenta de Supabase Auth propia de cada miembro — así cada uno
// tiene su propio auth.uid() real sin que el dueño ni el miembro
// necesiten manejar un correo de verdad para esto (ver
// supabase_permisos_miembros.sql).
export function correoSinteticoMiembro(miembroId: string): string {
  return `miembro-${miembroId}@${DOMINIO_SINTETICO}`;
}

// Crea la identidad propia de Supabase Auth de un miembro si todavía
// no la tiene, y devuelve su auth_user_id (el existente o el recién
// creado). La contraseña que se le pone a esta cuenta sintética es
// aleatoria y nunca se guarda ni se vuelve a usar: el inicio de sesión
// real del miembro siempre valida contra miembros_equipo.password_hash
// (bcrypt) y entra por un magic link apuntado a este correo sintético
// (ver app/api/miembros/entrar-como-miembro/route.ts) — nunca por
// signInWithPassword, que expondría todos los negocios al límite de
// intentos por IP de Supabase ya que el login pasa por el servidor.
export async function asegurarAuthUserId(
  miembroId: string,
  authUserIdActual: string | null
): Promise<string> {
  if (authUserIdActual) return authUserIdActual;

  const admin = obtenerSupabaseAdmin();
  const correo = correoSinteticoMiembro(miembroId);
  const passwordAleatoria = crypto.randomBytes(32).toString("hex");

  const { data, error } = await admin.auth.admin.createUser({
    email: correo,
    password: passwordAleatoria,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw error ?? new Error("No se pudo crear la identidad del miembro.");
  }

  const { error: errorUpdate } = await admin
    .from("miembros_equipo")
    .update({ auth_user_id: data.user.id })
    .eq("id", miembroId);

  if (errorUpdate) throw errorUpdate;

  return data.user.id;
}
