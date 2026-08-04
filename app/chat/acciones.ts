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
    .select("id, autor_id, autor_nombre, texto, imagen_url, creado_en")
    .order("creado_en", { ascending: false })
    .limit(LIMITE_MENSAJES);

  if (error) throw error;

  // Se pide descendente (los más recientes primero) para que el
  // límite se quede con los últimos N, no con los primeros N de toda
  // la historia — se revierte aquí para mostrarlos en orden cronológico.
  return (data ?? []).reverse() as MensajeChat[];
}

// imagenUrl es opcional: un mensaje puede ser solo texto, solo una
// foto, o ambos — ver supabase_chat_imagenes.sql.
export async function enviarMensaje(
  texto: string,
  autorNombre: string,
  imagenUrl: string | null = null
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuario no autenticado");

  const limpio = texto.trim();
  if (!limpio && !imagenUrl) throw new Error("MENSAJE_VACIO");

  const negocioId = await obtenerNegocioId(user.id);

  const { error } = await supabase.from("mensajes_chat").insert({
    user_id: negocioId,
    autor_id: user.id,
    autor_nombre: autorNombre,
    texto: limpio,
    imagen_url: imagenUrl,
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
