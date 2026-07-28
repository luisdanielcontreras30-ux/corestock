"use client";

import { useState } from "react";
import Link from "next/link";
import { LifeBuoy, MessageCircle, PlayCircle, Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";
import { supabase } from "../../../lib/supabase";
import {
  ENLACE_SOPORTE_WHATSAPP,
  NUMERO_SOPORTE_VISIBLE,
} from "../../../lib/soporte";

// Lo que responde el diagnóstico de /api/ia/asistente.
interface EstadoIA {
  configurada: boolean;
  motivo: string;
  detalle?: string;
  modelo?: string;
}

export default function AyudaTab() {
  const { t } = useIdioma();
  const [probando, setProbando] = useState(false);
  const [estadoIA, setEstadoIA] = useState<EstadoIA | null>(null);

  // El Asistente cae al motor de reglas en silencio cuando la IA falla,
  // así que desde fuera "no está configurada" y "está configurada pero
  // se cayó" se ven igual. Esto las distingue: hace una llamada mínima
  // de verdad y dice qué pasó.
  async function probarIA() {
    if (probando) return;
    setProbando(true);
    setEstadoIA(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setEstadoIA({ configurada: false, motivo: "sin_sesion" });
        return;
      }

      const respuesta = await fetch("/api/ia/asistente", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setEstadoIA(await respuesta.json());
    } catch (error) {
      console.error(error);
      setEstadoIA({ configurada: false, motivo: "sin_red" });
    } finally {
      setProbando(false);
    }
  }

  const iaBien = estadoIA?.motivo === "ok";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card" style={{ maxWidth: 480 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "rgba(37, 211, 102, 0.12)",
            display: "grid",
            placeItems: "center",
            marginBottom: 12,
          }}
        >
          <LifeBuoy size={26} color="#25d366" />
        </div>
        <h2 style={{ marginBottom: 6 }}>{t("ayuda.titulo")}</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 18, fontSize: 13.5, lineHeight: 1.6 }}>
          {t("ayuda.texto")}
        </p>
        <a
          href={ENLACE_SOPORTE_WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}
        >
          <MessageCircle size={15} /> {t("soporte.boton")}
        </a>

        {/* El botón de arriba abre WhatsApp Web en computadora, que pide
            iniciar sesión aparte — con el número a la vista se puede
            guardar o marcar desde el teléfono sin depender del enlace. */}
        <p style={{ color: "var(--text-secondary)", fontSize: 12.5, margin: "14px 0 0 0" }}>
          {t("ayuda.numero_etiqueta")}{" "}
          <span style={{ color: "var(--text-primary)", fontWeight: 600, whiteSpace: "nowrap" }}>
            {NUMERO_SOPORTE_VISIBLE}
          </span>
        </p>
      </div>

      {/* Diagnóstico de la IA. Va en Ayuda y no en una pantalla de
          desarrollo porque quien instala la app es la misma persona que
          atiende el negocio: si el Asistente "se siente tonto", este es
          el botón que le dice si es la llave, el saldo o el modelo. */}
      <div className="card" style={{ maxWidth: 480 }}>
        <h2 style={{ marginBottom: 6, fontSize: 16 }}>{t("ayuda.ia_titulo")}</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 16, fontSize: 13, lineHeight: 1.6 }}>
          {t("ayuda.ia_texto")}
        </p>

        <button
          className="btn-secondary"
          onClick={probarIA}
          disabled={probando}
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <Sparkles size={15} /> {probando ? t("ayuda.ia_probando") : t("ayuda.ia_boton")}
        </button>

        {estadoIA && (
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              marginTop: 16,
              padding: "12px 14px",
              borderRadius: 10,
              background: iaBien ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.12)",
              border: `1px solid ${iaBien ? "rgba(16, 185, 129, 0.35)" : "rgba(245, 158, 11, 0.35)"}`,
            }}
          >
            {iaBien ? (
              <CheckCircle2 size={17} color="#10b981" style={{ flexShrink: 0, marginTop: 1 }} />
            ) : (
              <XCircle size={17} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
            )}

            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--text-primary)" }}>
                {t(`ayuda.ia_estado_${estadoIA.motivo}`)}
              </p>

              {/* El texto crudo del proveedor ("Insufficient credits",
                  "model not found") no se traduce a propósito: es lo que
                  hay que buscar o pegarle a soporte tal cual. */}
              {estadoIA.detalle && !iaBien && (
                <p
                  style={{
                    margin: "8px 0 0 0",
                    fontSize: 11.5,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    color: "var(--text-secondary)",
                    overflowWrap: "anywhere",
                  }}
                >
                  {estadoIA.detalle}
                </p>
              )}

              {estadoIA.modelo && (
                <p style={{ margin: "8px 0 0 0", fontSize: 11.5, color: "var(--text-secondary)" }}>
                  {t("ayuda.ia_modelo")} {estadoIA.modelo}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Las guías del módulo de Tutoriales resuelven las dudas más
          comunes sin tener que esperar una respuesta de soporte. */}
      <div className="card" style={{ maxWidth: 480 }}>
        <h2 style={{ marginBottom: 6, fontSize: 16 }}>{t("ayuda.tutoriales_titulo")}</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 16, fontSize: 13 }}>
          {t("ayuda.tutoriales_texto")}
        </p>
        <Link
          href="/tutoriales"
          className="btn-secondary"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}
        >
          <PlayCircle size={15} /> {t("ayuda.tutoriales_boton")}
        </Link>
      </div>
    </div>
  );
}
