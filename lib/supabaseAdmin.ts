import { createClient } from "@supabase/supabase-js";

// Cliente de Supabase con la service_role key — se salta RLS por
// completo. Uso EXCLUSIVO del servidor (rutas de app/api/**, en
// particular el webhook de Stripe, que no tiene una sesión de usuario
// para autenticar la escritura). Nunca importar desde un componente
// "use client" ni exponer esta key con el prefijo NEXT_PUBLIC_.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let admin: ReturnType<typeof createClient<any, any, any>> | null = null;

export function obtenerSupabaseAdmin() {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Define esta última como variable de entorno del servidor (nunca con prefijo NEXT_PUBLIC_)."
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admin = createClient<any, any, any>(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return admin;
}
