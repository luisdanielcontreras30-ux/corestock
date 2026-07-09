"use client";

import { useIdioma } from "../../../components/LanguageProvider";
import { IDIOMAS_DISPONIBLES } from "../../../lib/i18n";

export default function IdiomaTab() {
  const { idioma, cambiarIdioma, t } = useIdioma();

  return (
    <div className="card">
      <h2 style={{ marginBottom: 6 }}>{t("idioma.titulo")}</h2>
      <p
        style={{
          color: "var(--text-secondary)",
          marginBottom: 20,
          fontSize: 13,
        }}
      >
        {t("idioma.subtitulo")}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        {IDIOMAS_DISPONIBLES.map((opcion) => {
          const activo = idioma === opcion.valor;

          return (
            <button
              key={opcion.valor}
              onClick={() => cambiarIdioma(opcion.valor)}
              style={{
                textAlign: "left",
                padding: 16,
                borderRadius: "var(--radius-lg)",
                border: activo
                  ? "2px solid var(--primary)"
                  : "1px solid var(--border)",
                background: "var(--card-hover)",
                cursor: "pointer",
                transition:
                  "border-color .2s ease, transform .15s ease",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span style={{ fontSize: 28 }}>{opcion.bandera}</span>

              <span
                style={{
                  color: "var(--text-primary)",
                  fontWeight: 700,
                  fontSize: 15,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {opcion.nombre}
                {activo && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--primary)",
                      fontWeight: 700,
                    }}
                  >
                    ● {t("idioma.activo")}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
