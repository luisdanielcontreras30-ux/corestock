"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Send, Bot, User, Copy } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import RequierePlus from "../../components/RequierePlus";
import { mensajeErrorSeguro } from "../../lib/errores";
import { probarVendedorIA, ErrorVendedorIA } from "../../lib/whatsappVendedor";
import { cargarNumeroWhatsApp, guardarNumeroWhatsApp } from "./acciones";
import { copiarAlPortapapeles } from "../../lib/portapapeles";
import { tieneAccesoBeta } from "../../lib/betaAcceso";

interface Intercambio {
  id: number;
  pregunta: string;
  respuesta: string;
}

export default function WhatsappPage() {
  return (
    <RequierePlus>
      <WhatsappContenido />
    </RequierePlus>
  );
}

function WhatsappContenido() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t, idioma } = useIdioma();
  const { mostrarToast } = useToast();

  const [pregunta, setPregunta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [intercambios, setIntercambios] = useState<Intercambio[]>([]);
  const finRef = useRef<HTMLDivElement>(null);
  // Mismo enfriamiento que "Analizar con IA" en Productos (ver
  // app/productos/page.tsx) — ambas rutas comparten la misma cuota de
  // Gemini, así que un 429 acá también significa esperar antes de
  // reintentar, no solo en la otra pantalla.
  const [enfriamientoIA, setEnfriamientoIA] = useState(0);

  const [numeroWhatsApp, setNumeroWhatsApp] = useState("");
  const [numeroGuardado, setNumeroGuardado] = useState<string | null>(null);
  const [cargandoNumero, setCargandoNumero] = useState(true);
  const [guardandoNumero, setGuardandoNumero] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (cargandoAuth) return;
    if (!user) {
      router.push("/login");
      return;
    }
    // Beta cerrada — quien no tiene acceso ni entra por URL directa,
    // no solo se le oculta del menú (ver lib/betaAcceso.ts).
    if (!tieneAccesoBeta(user.email)) router.push("/menu");
  }, [cargandoAuth, user]);

  useEffect(() => {
    if (cargandoAuth || !user) return;

    cargarNumeroWhatsApp()
      .then((valor) => {
        setNumeroGuardado(valor);
        setNumeroWhatsApp(valor ?? "");
      })
      .catch((error) => {
        console.error(error);
        mostrarToast(t("comun.msg_error_cargar_datos"), "error");
      })
      .finally(() => setCargandoNumero(false));
  }, [cargandoAuth, user]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [intercambios, enviando]);

  useEffect(() => {
    if (enfriamientoIA <= 0) return;
    const id = setTimeout(() => setEnfriamientoIA((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [enfriamientoIA]);

  async function guardarNumero() {
    if (guardandoNumero) return;

    setGuardandoNumero(true);
    try {
      await guardarNumeroWhatsApp(numeroWhatsApp);
      setNumeroGuardado(numeroWhatsApp.trim() || null);
      mostrarToast(t("whatsapp.msg_numero_guardado"), "exito");
    } catch (error) {
      console.error(error);
      const detalle =
        error instanceof Error && error.message === "EMPRESA_NO_CONFIGURADA"
          ? t("catalogo_linea.msg_falta_empresa")
          : error instanceof Error && error.message === "SIN_ACCESO_BETA"
            ? t("permisos.sin_acceso_accion")
            : mensajeErrorSeguro(error);
      mostrarToast(detalle || t("whatsapp.msg_error_numero"), "error");
    } finally {
      setGuardandoNumero(false);
    }
  }

  const urlWebhook =
    typeof window !== "undefined" ? `${window.location.origin}/api/whatsapp/webhook` : "";

  async function copiarUrlWebhook() {
    const exito = await copiarAlPortapapeles(urlWebhook);
    if (exito) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } else {
      mostrarToast(t("comun.msg_error_copiar"), "error");
    }
  }

  async function probar() {
    const textoPregunta = pregunta.trim();
    if (!textoPregunta || enviando) return;

    if (enfriamientoIA > 0) {
      mostrarToast(t("productos.ia_enfriamiento").replace("{segundos}", String(enfriamientoIA)), "error");
      return;
    }

    setEnviando(true);
    setPregunta("");
    try {
      const respuesta = await probarVendedorIA(textoPregunta, idioma);
      setIntercambios((prev) => [...prev, { id: Date.now(), pregunta: textoPregunta, respuesta }]);
    } catch (error) {
      console.error(error);
      if (error instanceof ErrorVendedorIA && error.status === 429) setEnfriamientoIA(60);
      const detalle = mensajeErrorSeguro(error);
      mostrarToast(detalle || t("whatsapp.msg_error_probar"), "error");
    } finally {
      setEnviando(false);
    }
  }

  if (cargandoAuth || !user || !tieneAccesoBeta(user.email)) {
    return (
      <main className="fade-up">
        <div className="card">{t("header.cargando")}</div>
      </main>
    );
  }

  return (
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <EncabezadoModulo
        Icono={MessageCircle}
        color="#25d366"
        titulo={t("sidebar.whatsapp")}
        subtitulo={t("whatsapp.subtitulo")}
      />

      <div className="card">
        <h2 style={{ marginBottom: 10 }}>{t("whatsapp.conectar_titulo")}</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 13.5, lineHeight: 1.6, marginBottom: 18 }}>
          {t("whatsapp.conectar_texto")}
        </p>

        <label style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
          {t("whatsapp.webhook_url_label")}
        </label>
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <input value={urlWebhook} readOnly onFocus={(e) => e.target.select()} />
          <button
            type="button"
            className="btn-secondary"
            onClick={copiarUrlWebhook}
            style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
          >
            <Copy size={14} /> {copiado ? t("catalogo_linea.copiado") : t("catalogo_linea.copiar_enlace")}
          </button>
        </div>

        <label style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
          {t("whatsapp.numero_label")}
        </label>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={numeroWhatsApp}
            onChange={(e) => setNumeroWhatsApp(e.target.value)}
            placeholder={t("whatsapp.numero_placeholder")}
            disabled={cargandoNumero || guardandoNumero}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={guardarNumero}
            disabled={cargandoNumero || guardandoNumero || numeroWhatsApp.trim() === (numeroGuardado ?? "")}
            style={{ flexShrink: 0 }}
          >
            {guardandoNumero ? t("compras.guardando") : t("whatsapp.numero_guardar")}
          </button>
        </div>
        {numeroGuardado && (
          <p style={{ color: "#22c55e", fontSize: 12.5, marginTop: 8, marginBottom: 0 }}>
            {t("whatsapp.numero_conectado")}
          </p>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 4 }}>{t("whatsapp.prueba_titulo")}</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 13.5, marginBottom: 18 }}>
          {t("whatsapp.prueba_texto")}
        </p>

        <div
          style={{
            maxHeight: 360,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginBottom: 16,
            padding: intercambios.length > 0 ? "4px 4px 0 4px" : 0,
          }}
        >
          {intercambios.length === 0 && !enviando && (
            <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
              {t("whatsapp.sin_pruebas")}
            </p>
          )}

          {intercambios.map((ix) => (
            <div key={ix.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: "row-reverse" }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    background: "var(--card-hover)",
                    color: "var(--text-primary)",
                  }}
                >
                  <User size={14} />
                </div>
                <div
                  style={{
                    maxWidth: "72%",
                    minWidth: 0,
                    overflowWrap: "anywhere",
                    background: "var(--primary-soft)",
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    padding: "10px 14px",
                    fontSize: 13.5,
                    lineHeight: 1.5,
                  }}
                >
                  {ix.pregunta}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    background: "#25d366",
                    color: "#fff",
                  }}
                >
                  <Bot size={14} />
                </div>
                <div
                  style={{
                    maxWidth: "72%",
                    minWidth: 0,
                    overflowWrap: "anywhere",
                    background: "var(--glass-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    padding: "10px 14px",
                    fontSize: 13.5,
                    lineHeight: 1.5,
                  }}
                >
                  {ix.respuesta}
                </div>
              </div>
            </div>
          ))}

          {enviando && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  background: "#25d366",
                  color: "#fff",
                }}
              >
                <Bot size={14} />
              </div>
              <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{t("whatsapp.pensando")}</span>
            </div>
          )}

          <div ref={finRef} />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") probar();
            }}
            placeholder={
              enfriamientoIA > 0
                ? t("productos.ia_enfriamiento").replace("{segundos}", String(enfriamientoIA))
                : t("whatsapp.prueba_placeholder")
            }
            disabled={enviando || enfriamientoIA > 0}
          />
          <button
            className="btn-primary"
            onClick={probar}
            disabled={enviando || enfriamientoIA > 0 || !pregunta.trim()}
            aria-label={t("whatsapp.prueba_enviar")}
            style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </main>
  );
}
