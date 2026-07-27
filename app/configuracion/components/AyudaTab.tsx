"use client";

import Link from "next/link";
import { LifeBuoy, MessageCircle, PlayCircle } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";
import {
  ENLACE_SOPORTE_WHATSAPP,
  NUMERO_SOPORTE_VISIBLE,
} from "../../../lib/soporte";

export default function AyudaTab() {
  const { t } = useIdioma();

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
