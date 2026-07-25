"use client";

import { Sparkles, MessageCircle } from "lucide-react";
import { useIdioma } from "./LanguageProvider";
import { ENLACE_SOPORTE_WHATSAPP } from "../lib/soporte";

// Reemplaza el contenido de una función que depende de una API de IA
// que hoy no está activada (falta la llave de Google AI en el
// servidor) — en vez de dejar que la persona intente usarla y se
// tope con un error crudo, se le explica la situación de una vez y se
// le da un canal directo para apoyar a que se active.
export default function IaNoDisponible() {
  const { t } = useIdioma();

  return (
    <div className="card ia-no-disponible-card">
      <div className="ia-no-disponible-icono">
        <Sparkles size={26} color="#8b5cf6" />
      </div>
      <h3 style={{ marginBottom: 6 }}>{t("ia_no_disponible.titulo")}</h3>
      <p style={{ color: "var(--text-secondary)", fontSize: 13.5, lineHeight: 1.6, marginBottom: 18 }}>
        {t("ia_no_disponible.mensaje")}
      </p>
      <a
        href={ENLACE_SOPORTE_WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary"
        style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}
      >
        <MessageCircle size={15} /> {t("ia_no_disponible.boton_contacto")}
      </a>
    </div>
  );
}
