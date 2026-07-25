"use client";

import { LifeBuoy, MessageCircle } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";
import { ENLACE_SOPORTE_WHATSAPP } from "../../../lib/soporte";

export default function AyudaTab() {
  const { t } = useIdioma();

  return (
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
    </div>
  );
}
