"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Send, Bot, User } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import RequierePlus from "../../components/RequierePlus";
import { mensajeErrorSeguro } from "../../lib/errores";
import { probarVendedorIA } from "../../lib/whatsappVendedor";

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

  useEffect(() => {
    if (cargandoAuth) return;
    if (!user) router.push("/login");
  }, [cargandoAuth, user]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [intercambios, enviando]);

  async function probar() {
    const textoPregunta = pregunta.trim();
    if (!textoPregunta || enviando) return;

    setEnviando(true);
    setPregunta("");
    try {
      const respuesta = await probarVendedorIA(textoPregunta, idioma);
      setIntercambios((prev) => [...prev, { id: Date.now(), pregunta: textoPregunta, respuesta }]);
    } catch (error) {
      console.error(error);
      const detalle = mensajeErrorSeguro(error);
      mostrarToast(detalle || t("whatsapp.msg_error_probar"), "error");
    } finally {
      setEnviando(false);
    }
  }

  if (cargandoAuth || !user) {
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
        <p style={{ color: "var(--text-secondary)", fontSize: 13.5, lineHeight: 1.6, marginBottom: 0 }}>
          {t("whatsapp.conectar_texto")}
        </p>
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
            placeholder={t("whatsapp.prueba_placeholder")}
            disabled={enviando}
          />
          <button
            className="btn-primary"
            onClick={probar}
            disabled={enviando || !pregunta.trim()}
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
