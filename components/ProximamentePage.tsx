"use client";

import { LucideIcon } from "lucide-react";
import { useIdioma } from "./LanguageProvider";

// Placeholder reutilizable para los módulos que todavía no tienen
// funcionalidad propia (ver navegación en lib/navegacion.ts).
export default function ProximamentePage({
  Icono,
  tituloClave,
}: {
  Icono: LucideIcon;
  tituloClave: string;
}) {
  const { t } = useIdioma();
  const titulo = t(tituloClave);

  return (
    <main className="fade-up proximamente-page">
      <div className="card proximamente-card">
        <div className="proximamente-icono">
          <Icono size={30} color="var(--primary)" />
        </div>
        <span className="proximamente-badge">{t("proximamente.badge")}</span>
        <h1>{titulo}</h1>
        <p>{t("proximamente.mensaje").replace("{modulo}", titulo)}</p>
      </div>
    </main>
  );
}
