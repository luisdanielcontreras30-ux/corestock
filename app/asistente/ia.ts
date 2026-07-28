import { supabase } from "../../lib/supabase";

// Puente del navegador con /api/ia/asistente. La llave de OpenRouter
// vive SOLO en el servidor: aquí nunca se ve ni se toca.
//
// La regla de este archivo es una sola: nunca lanza. Devuelve el texto
// de la IA o null. Ese null es lo que hace que el Asistente caiga al
// motor de reglas sin enseñar un error — desde el punto de vista de
// quien pregunta, el asistente simplemente respondió.

export interface MensajeIA {
  rol: "usuario" | "asistente";
  texto: string;
}

export async function preguntarAIa(
  pregunta: string,
  historial: MensajeIA[],
  idioma: string
): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) return null;

    const respuesta = await fetch("/api/ia/asistente", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ pregunta, historial, idioma }),
    });

    if (!respuesta.ok) {
      // 429 es el único caso donde el silencio sería confuso: la
      // persona hizo demasiadas preguntas seguidas y merece saberlo en
      // vez de notar que el asistente se volvió tonto de repente.
      if (respuesta.status === 429) {
        const cuerpo = await respuesta.json().catch(() => null);
        const texto = (cuerpo as { error?: string } | null)?.error;
        if (texto) return texto;
      }
      return null;
    }

    const cuerpo = await respuesta.json();
    const texto = (cuerpo as { respuesta?: unknown }).respuesta;

    return typeof texto === "string" && texto.trim() ? texto.trim() : null;
  } catch {
    // Sin conexión, plazo vencido, servidor caído: todo cae al respaldo.
    return null;
  }
}
