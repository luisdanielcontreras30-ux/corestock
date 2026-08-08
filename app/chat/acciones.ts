import { supabase } from "../../lib/supabase";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { subirImagenSegura, ErrorSubidaImagen } from "../../lib/uploads";
import { MensajeChat } from "./types";

// Cuántos mensajes trae la carga inicial — un canal de avisos rápidos
// entre el equipo no necesita historial completo, y traer todo crecería
// sin límite con el tiempo.
const LIMITE_MENSAJES = 200;

export async function cargarMensajes(): Promise<MensajeChat[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("mensajes_chat")
    .select("id, autor_id, autor_nombre, texto, imagen_url, audio_url, creado_en")
    .order("creado_en", { ascending: false })
    .limit(LIMITE_MENSAJES);

  if (error) throw error;

  // Se pide descendente (los más recientes primero) para que el
  // límite se quede con los últimos N, no con los primeros N de toda
  // la historia — se revierte aquí para mostrarlos en orden cronológico.
  return (data ?? []).reverse() as MensajeChat[];
}

// imagenUrl/audioUrl son opcionales: un mensaje puede ser solo texto,
// solo una foto, solo un audio, o cualquier combinación — ver
// supabase_chat_imagenes.sql / supabase_chat_audio.sql.
export async function enviarMensaje(
  texto: string,
  autorNombre: string,
  imagenUrl: string | null = null,
  audioUrl: string | null = null
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuario no autenticado");

  const limpio = texto.trim();
  if (!limpio && !imagenUrl && !audioUrl) throw new Error("MENSAJE_VACIO");

  const negocioId = await obtenerNegocioId(user.id);

  const { error } = await supabase.from("mensajes_chat").insert({
    user_id: negocioId,
    autor_id: user.id,
    autor_nombre: autorNombre,
    texto: limpio,
    imagen_url: imagenUrl,
    audio_url: audioUrl,
  });

  if (error) throw error;
}

// Reutiliza el bucket "productos" (mismo que fotos de producto y logo
// del negocio, ver lib/uploads.ts) con el prefijo "chat-" — evita
// pedirle al dueño que cree y configure un bucket nuevo solo para el
// chat.
export async function subirImagenChat(archivo: File): Promise<{ url: string | null; error: ErrorSubidaImagen | null }> {
  return subirImagenSegura("productos", archivo, "chat-");
}

const EXTENSION_AUDIO_POR_TIPO: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
};

// Un mensaje de voz "tipo radio" (mantener presionado para hablar) no
// debería durar más de un par de minutos — 8 MB alcanza de sobra para
// eso con los códecs comprimidos que usa MediaRecorder (opus/aac).
const TAMANO_MAXIMO_AUDIO_BYTES = 8 * 1024 * 1024;

export type ErrorSubidaAudio = "tipo_invalido" | "muy_grande" | "fallo_subida";

// Mismo bucket y mismo criterio que subirImagenChat — solo cambia el
// prefijo del nombre de archivo.
export async function subirAudioChat(
  blob: Blob
): Promise<{ url: string | null; error: ErrorSubidaAudio | null }> {
  // Igual que subirImagenSegura (lib/uploads.ts): se rechaza un tipo
  // desconocido en vez de asumir ".webm" a ciegas — antes cualquier
  // blob, tuviera o no un tipo de audio real, se subía y etiquetaba
  // como webm sin validar nada.
  const extension = EXTENSION_AUDIO_POR_TIPO[blob.type];
  if (!extension) {
    return { url: null, error: "tipo_invalido" };
  }

  if (blob.size > TAMANO_MAXIMO_AUDIO_BYTES) {
    return { url: null, error: "muy_grande" };
  }

  const nombreArchivo = `chat-audio-${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from("productos")
    .upload(nombreArchivo, blob, { contentType: blob.type || "audio/webm" });

  if (error) {
    return { url: null, error: "fallo_subida" };
  }

  const { data } = supabase.storage.from("productos").getPublicUrl(nombreArchivo);

  return { url: data.publicUrl, error: null };
}

// Suscripción en vivo (Supabase Realtime, ver supabase_chat_equipo.sql)
// a los mensajes nuevos de ESTE negocio — así un mensaje que manda otro
// miembro aparece sin que nadie tenga que recargar la página. Devuelve
// la función para cancelar la suscripción al desmontar.
export function suscribirseAMensajes(
  negocioId: string,
  alRecibir: (mensaje: MensajeChat) => void
): () => void {
  const canal = supabase
    .channel(`mensajes_chat_${negocioId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "mensajes_chat",
        filter: `user_id=eq.${negocioId}`,
      },
      (payload) => {
        alRecibir(payload.new as MensajeChat);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}
