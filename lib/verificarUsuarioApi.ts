import { createClient } from "@supabase/supabase-js";

// Verifica el JWT que el cliente manda en el header Authorization y
// devuelve el usuario autenticado, o null si no es válido. Uso
// EXCLUSIVO de rutas de servidor (app/api/**) que reciben el access
// token del usuario para identificarlo antes de actuar en su nombre.
export async function verificarUsuarioApi(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return null;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user;
}
