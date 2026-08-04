"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessagesSquare, Send, Inbox } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useMiembroActivo } from "../../components/MiembroActivoProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import CargandoLista from "../../components/CargandoLista";
import { MensajeChat } from "./types";
import { cargarMensajes, enviarMensaje, suscribirseAMensajes } from "./acciones";
import { obtenerNegocioId } from "../../lib/negocioActual";

function formatoHora(fecha: string) {
  return new Date(fecha).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
  const contenedorRef = useRef<HTMLDivElement>(null);

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
        mostrarToast(t("comun.msg_error_cargar_datos"), "error");
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
      mostrarToast(t("chat.msg_error_enviar"), "error");
    } finally {
      setEnviando(false);
    }
  }

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
                  <p className="chat-burbuja-texto">{m.texto}</p>
                  <span className="chat-burbuja-hora">{formatoHora(m.creado_en)}</span>
                </div>
              );
            })
          )}
        </div>

        <form className="chat-form" onSubmit={alEnviar}>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={t("chat.placeholder")}
            maxLength={2000}
            disabled={enviando}
          />
          <button type="submit" className="btn-primary chat-form-enviar" disabled={enviando || !texto.trim()}>
            <Send size={16} />
          </button>
        </form>
      </div>
    </main>
  );
}
