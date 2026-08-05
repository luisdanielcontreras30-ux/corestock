"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { MessagesSquare, Send, Inbox, ImagePlus, Mic } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useMiembroActivo } from "../../components/MiembroActivoProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import CargandoLista from "../../components/CargandoLista";
import { MensajeChat } from "./types";
import { cargarMensajes, enviarMensaje, suscribirseAMensajes, subirImagenChat, subirAudioChat } from "./acciones";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { redimensionarParaSubir } from "../../lib/imagenes";

// enviarMensaje() siempre manda imagen_url/audio_url en el insert
// (aunque sea un mensaje de puro texto — ver acciones.ts), así que si
// solo se corrió supabase_chat_equipo.sql pero no supabase_chat_
// imagenes.sql/supabase_chat_audio.sql, ni un mensaje de texto se
// puede mandar: Postgres rechaza CUALQUIER insert que mencione una
// columna que no existe. Sin esto se veía como "no se pudo enviar el
// mensaje" a secas, sin ninguna pista de qué corregir.
function esColumnaFaltante(error: unknown): boolean {
  const codigo = (error as { code?: string } | null)?.code;
  const mensaje = ((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    codigo === "42703" ||
    codigo === "PGRST204" ||
    mensaje.includes("imagen_url") ||
    mensaje.includes("audio_url")
  );
}

function formatoHora(fecha: string) {
  return new Date(fecha).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatoDuracion(segundos: number) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// El primero que el navegador soporte, de mejor a peor compatibilidad
// (Chrome/Firefox/Android entienden webm+opus; Safari solo mp4/aac).
const MIME_CANDIDATOS = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function elegirMimeTypeAudio(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATOS.find((tipo) => MediaRecorder.isTypeSupported(tipo)) ?? "";
}

// Una presión accidental (roce, doble tap) no debería mandar un
// mensaje de voz de una fracción de segundo.
const DURACION_MINIMA_MS = 400;

// Mide cuánto duró la grabación — envuelto en su propia función para
// que quede claro que solo se usa dentro de manejadores de eventos
// (mantener presionado / soltar el micrófono), nunca durante el render.
function marcaDeTiempo(): number {
  return Date.now();
}

export default function ChatPage() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { miembroActivo } = useMiembroActivo();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [segundosGrabando, setSegundosGrabando] = useState(0);
  const [subiendoAudio, setSubiendoAudio] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const imagenInputRef = useRef<HTMLInputElement>(null);
  const grabadoraRef = useRef<MediaRecorder | null>(null);
  const fragmentosAudioRef = useRef<Blob[]>([]);
  const inicioGrabacionRef = useRef(0);
  const temporizadorGrabacionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // true desde que se pide iniciar hasta que la grabación termina —
  // cubre el hueco entre presionar el botón y que getUserMedia
  // resuelva, que "grabando" (estado de React) no puede cubrir a
  // tiempo porque solo se actualiza después de ese await.
  const grabacionActivaRef = useRef(false);
  // Se soltó el botón mientras getUserMedia todavía no resolvía.
  const detenerPendienteRef = useRef(false);
  // false solo durante el cleanup de desmontaje: ahí se detiene el
  // MediaRecorder para soltar el micrófono, pero no se debe enviar el
  // audio a medio grabar como si el usuario hubiera terminado de hablar.
  const enviarAlDetenerRef = useRef(true);

  // El dueño no tiene un "nombre" propio guardado en ningún lado (a
  // diferencia de un miembro del equipo) — se usa la parte del correo
  // antes de "@", mismo criterio que ya usa el saludo del Dashboard.
  const nombrePropio = miembroActivo?.nombre ?? user?.email?.split("@")[0] ?? t("chat.dueno");

  useEffect(() => {
    if (cargandoAuth) return;

    if (!user) {
      router.push("/login");
      return;
    }

    let cancelado = false;
    let cancelarSuscripcion: (() => void) | null = null;

    async function iniciar() {
      try {
        const datos = await cargarMensajes();
        if (cancelado) return;
        setMensajes(datos);
      } catch (error) {
        console.error(error);
        mostrarToast(
          esColumnaFaltante(error) ? t("chat.msg_falta_migracion") : t("comun.msg_error_cargar_datos"),
          "error"
        );
      } finally {
        if (!cancelado) setLoading(false);
      }

      try {
        const negocioId = await obtenerNegocioId(user!.id);
        if (cancelado) return;

        cancelarSuscripcion = suscribirseAMensajes(negocioId, (mensaje) => {
          setMensajes((prev) => (prev.some((m) => m.id === mensaje.id) ? prev : [...prev, mensaje]));
        });
      } catch (error) {
        // Sin tiempo real, el chat sigue funcionando (solo no se
        // actualiza solo) — no vale la pena un toast de error por esto.
        console.error(error);
      }
    }

    iniciar();

    return () => {
      cancelado = true;
      cancelarSuscripcion?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargandoAuth, user]);

  useEffect(() => {
    contenedorRef.current?.scrollTo({ top: contenedorRef.current.scrollHeight });
  }, [mensajes.length]);

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();

    const limpio = texto.trim();
    if (!limpio || enviando) return;

    setEnviando(true);
    try {
      await enviarMensaje(limpio, nombrePropio);
      setTexto("");
      // No se agrega el mensaje aquí de forma optimista: llega solo por
      // la suscripción en tiempo real (suscribirseAMensajes), igual que
      // el de cualquier otro miembro — así nunca hay que reconciliar un
      // id temporal con el id real que le asigna la base de datos.
    } catch (error) {
      console.error(error);
      mostrarToast(
        esColumnaFaltante(error) ? t("chat.msg_falta_migracion") : t("chat.msg_error_enviar"),
        "error"
      );
    } finally {
      setEnviando(false);
    }
  }

  // Sube y envía en un solo paso (sin vista previa de por medio): el
  // texto que ya esté escrito en el input, si hay, viaja como
  // descripción de la foto en el mismo mensaje.
  async function alElegirImagen(archivo: File | undefined) {
    if (!archivo || subiendoImagen || enviando) return;

    setSubiendoImagen(true);
    try {
      const archivoParaSubir = await redimensionarParaSubir(archivo);
      const { url, error } = await subirImagenChat(archivoParaSubir);

      if (error === "tipo_invalido") {
        mostrarToast(t("chat.msg_imagen_tipo_invalido"), "error");
      } else if (error === "muy_grande") {
        mostrarToast(t("chat.msg_imagen_muy_grande"), "error");
      } else if (error || !url) {
        mostrarToast(t("chat.msg_error_imagen"), "error");
      } else {
        await enviarMensaje(texto, nombrePropio, url);
        setTexto("");
      }
    } catch (error) {
      console.error(error);
      mostrarToast(
        esColumnaFaltante(error) ? t("chat.msg_falta_migracion") : t("chat.msg_error_imagen"),
        "error"
      );
    } finally {
      setSubiendoImagen(false);
      if (imagenInputRef.current) imagenInputRef.current.value = "";
    }
  }

  // Mantener presionado para hablar, tipo radio: graba mientras el
  // botón sigue presionado y envía en cuanto se suelta — no hay paso
  // de "revisar antes de mandar" a propósito, para que se sienta
  // instantáneo como un walkie-talkie real.
  async function iniciarGrabacion() {
    if (grabacionActivaRef.current || enviando || subiendoImagen || subiendoAudio) return;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      mostrarToast(t("chat.msg_sin_microfono"), "error");
      return;
    }

    // Se marca de inmediato, antes del await: un tap-y-suelta muy
    // rápido puede llamar a detenerGrabacion() mientras getUserMedia
    // todavía no resuelve y "grabando" (estado de React) sigue en
    // false — sin este ref esa señal de soltar se perdía y el
    // micrófono se quedaba grabando indefinidamente.
    grabacionActivaRef.current = true;
    detenerPendienteRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (detenerPendienteRef.current) {
        // Ya se soltó el botón mientras se esperaba el permiso del
        // micrófono — no hay nada que grabar, solo liberar el stream.
        stream.getTracks().forEach((track) => track.stop());
        grabacionActivaRef.current = false;
        return;
      }

      const mimeType = elegirMimeTypeAudio();
      const grabadora = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      fragmentosAudioRef.current = [];
      grabadora.ondataavailable = (evento) => {
        if (evento.data.size > 0) fragmentosAudioRef.current.push(evento.data);
      };
      grabadora.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        grabacionActivaRef.current = false;
        const duracionMs = marcaDeTiempo() - inicioGrabacionRef.current;
        const blob = new Blob(fragmentosAudioRef.current, { type: grabadora.mimeType || "audio/webm" });
        fragmentosAudioRef.current = [];

        // Al desmontar (navegar fuera del chat) solo se debe soltar el
        // micrófono, no enviar el audio a medio grabar como si el
        // usuario hubiera terminado de hablar (ver cleanup más abajo).
        if (enviarAlDetenerRef.current) {
          enviarAudioGrabado(blob, duracionMs);
        }
      };

      grabadoraRef.current = grabadora;
      inicioGrabacionRef.current = marcaDeTiempo();
      grabadora.start();

      setGrabando(true);
      setSegundosGrabando(0);
      temporizadorGrabacionRef.current = setInterval(() => {
        setSegundosGrabando((s) => s + 1);
      }, 1000);
    } catch (error) {
      grabacionActivaRef.current = false;
      console.error(error);
      mostrarToast(t("chat.msg_error_microfono"), "error");
    }
  }

  function detenerGrabacion() {
    if (!grabacionActivaRef.current) return;

    if (!grabadoraRef.current) {
      // getUserMedia todavía no resuelve — se marca para cortar en
      // cuanto lo haga en vez de no hacer nada (ver iniciarGrabacion).
      detenerPendienteRef.current = true;
      return;
    }

    setGrabando(false);
    if (temporizadorGrabacionRef.current) {
      clearInterval(temporizadorGrabacionRef.current);
      temporizadorGrabacionRef.current = null;
    }
    enviarAlDetenerRef.current = true;
    grabadoraRef.current.stop();
  }

  async function enviarAudioGrabado(blob: Blob, duracionMs: number) {
    if (duracionMs < DURACION_MINIMA_MS) {
      mostrarToast(t("chat.msg_audio_muy_corto"), "error");
      return;
    }

    setSubiendoAudio(true);
    try {
      const { url, error } = await subirAudioChat(blob);

      if (error === "muy_grande") {
        mostrarToast(t("chat.msg_audio_muy_grande"), "error");
      } else if (error || !url) {
        mostrarToast(t("chat.msg_error_audio"), "error");
      } else {
        await enviarMensaje("", nombrePropio, null, url);
      }
    } catch (error) {
      console.error(error);
      mostrarToast(
        esColumnaFaltante(error) ? t("chat.msg_falta_migracion") : t("chat.msg_error_audio"),
        "error"
      );
    } finally {
      setSubiendoAudio(false);
    }
  }

  // Si se navega fuera del chat a media grabación, no debe quedar el
  // micrófono del navegador abierto en segundo plano.
  useEffect(() => {
    return () => {
      if (temporizadorGrabacionRef.current) clearInterval(temporizadorGrabacionRef.current);
      // Corta cualquier espera de getUserMedia en curso y le dice a
      // onstop que no envíe el audio: este stop es solo para soltar el
      // micrófono, no un "el usuario terminó de hablar".
      detenerPendienteRef.current = true;
      enviarAlDetenerRef.current = false;
      grabadoraRef.current?.stop();
    };
  }, []);

  if (cargandoAuth || !user) {
    return (
      <main className="fade-up">
        <CargandoLista />
      </main>
    );
  }

  return (
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <EncabezadoModulo
        Icono={MessagesSquare}
        color="#0ea5e9"
        titulo={t("chat.titulo")}
        subtitulo={t("chat.subtitulo")}
      />

      <div className="card chat-panel">
        <div className="chat-mensajes" ref={contenedorRef}>
          {loading ? (
            <CargandoLista />
          ) : mensajes.length === 0 ? (
            <div className="chat-vacio">
              <Inbox size={26} color="var(--text-muted)" />
              <span>{t("chat.sin_mensajes")}</span>
            </div>
          ) : (
            mensajes.map((m) => {
              const propio = m.autor_id === user.id;
              return (
                <div key={m.id} className={`chat-burbuja ${propio ? "chat-burbuja-propia" : ""}`}>
                  {!propio && <span className="chat-burbuja-autor">{m.autor_nombre}</span>}
                  {m.imagen_url && (
                    <a href={m.imagen_url} target="_blank" rel="noopener noreferrer" className="chat-burbuja-imagen-link">
                      <Image
                        src={m.imagen_url}
                        alt=""
                        width={320}
                        height={320}
                        className="chat-burbuja-imagen"
                      />
                    </a>
                  )}
                  {m.audio_url && <audio controls src={m.audio_url} className="chat-burbuja-audio" />}
                  {m.texto && <p className="chat-burbuja-texto">{m.texto}</p>}
                  <span className="chat-burbuja-hora">{formatoHora(m.creado_en)}</span>
                </div>
              );
            })
          )}
        </div>

        <form className="chat-form" onSubmit={alEnviar}>
          <input
            ref={imagenInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => alElegirImagen(e.target.files?.[0])}
          />

          <button
            type="button"
            className="btn-secondary chat-form-imagen"
            disabled={subiendoImagen || enviando || grabando || subiendoAudio}
            onClick={() => imagenInputRef.current?.click()}
            aria-label={t("chat.adjuntar_foto")}
            title={t("chat.adjuntar_foto")}
          >
            <ImagePlus size={18} />
          </button>

          {grabando ? (
            <div className="chat-form-grabando">
              <span className="chat-form-grabando-punto" />
              {t("chat.grabando")} · {formatoDuracion(segundosGrabando)}
            </div>
          ) : (
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={subiendoImagen ? t("chat.subiendo_foto") : subiendoAudio ? t("chat.subiendo_audio") : t("chat.placeholder")}
              maxLength={2000}
              disabled={enviando || subiendoImagen || subiendoAudio}
            />
          )}

          <button
            type="button"
            className={`btn-secondary chat-form-mic ${grabando ? "chat-form-mic-activo" : ""}`}
            disabled={enviando || subiendoImagen || subiendoAudio}
            onPointerDown={(e) => {
              e.preventDefault();
              iniciarGrabacion();
            }}
            onPointerUp={detenerGrabacion}
            onPointerLeave={detenerGrabacion}
            onPointerCancel={detenerGrabacion}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={t("chat.mantener_para_hablar")}
            title={t("chat.mantener_para_hablar")}
          >
            <Mic size={18} />
          </button>

          <button
            type="submit"
            className="btn-primary chat-form-enviar"
            disabled={enviando || subiendoImagen || subiendoAudio || grabando || !texto.trim()}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </main>
  );
}
