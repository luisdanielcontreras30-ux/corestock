import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Define esas variables en tu archivo .env.local."
  );
}

const TIMEOUT_MS = 15000;

// Sin esto, una petición sin Internet (o con una conexión muy
// degradada, ej. señal débil o una red cautiva que nunca responde)
// podía quedarse colgada mucho tiempo antes de que el navegador la
// diera por fallida — cada pantalla que no está pensada para operar
// offline (todas menos Venta Rápida y Caja) se quedaba con su spinner
// de "Cargando..." pegado y sin ningún mensaje, en vez de fallar
// rápido y mostrar el error de siempre.
//
// Lanza el mismo tipo de error que el navegador produce solo
// (TypeError "Failed to fetch") para que se comporte exactamente
// igual que un fallo de red real en el resto de la app — incluyendo
// esFalloDeRed() (lib/db.ts), que ya lo reconoce por ese mensaje.
async function fetchConLimite(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new TypeError("Failed to fetch");
  }

  return Promise.race([
    fetch(input, init),
    new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new TypeError("Failed to fetch")), TIMEOUT_MS);
    }),
  ]);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchConLimite },
});
