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
//
// Se usa AbortController en vez de un Promise.race a secas: con la
// carrera, al vencer el plazo la promesa de afuera se rechazaba pero la
// petición real seguía viva ocupando una de las ~6 conexiones que el
// navegador permite por dominio, así que con una red degradada (justo
// el caso que esto atiende) unas cuantas peticiones colgadas agotaban
// el cupo y bloqueaban a las siguientes. Cancelar de verdad libera la
// conexión. Además el temporizador se limpia siempre, en vez de dejar
// uno vivo 15 s por cada petición que sí respondió a tiempo.
async function fetchConLimite(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new TypeError("Failed to fetch");
  }

  const controlador = new AbortController();
  const senalOriginal = init?.signal;

  // Quien llama puede traer su propia señal (Supabase la usa, por
  // ejemplo, al refrescar la sesión). Como el signal se reemplaza por
  // el nuestro, su cancelación se reenvía para no perderla.
  if (senalOriginal) {
    if (senalOriginal.aborted) {
      controlador.abort(senalOriginal.reason);
    } else {
      senalOriginal.addEventListener("abort", () => controlador.abort(senalOriginal.reason), {
        once: true,
      });
    }
  }

  let vencioElPlazo = false;
  const temporizador = setTimeout(() => {
    vencioElPlazo = true;
    controlador.abort();
  }, TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controlador.signal });
  } catch (error) {
    // Solo el corte por plazo se disfraza de fallo de red; una
    // cancelación pedida por quien llama se propaga tal cual.
    if (vencioElPlazo) throw new TypeError("Failed to fetch");
    throw error;
  } finally {
    clearTimeout(temporizador);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchConLimite },
});
