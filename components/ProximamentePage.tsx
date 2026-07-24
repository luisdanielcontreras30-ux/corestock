"use client";

import { LucideIcon } from "lucide-react";
import { useIdioma } from "./LanguageProvider";

// Placeholder reutilizable para los módulos que todavía no tienen
// funcionalidad propia (ver navegación en lib/navegacion.ts). El color
// es opcional (colorMovil del módulo en navegacion.ts) — con él, el
// ícono se pinta con el mismo acento que ese módulo ya usa en la
// navegación, en vez de quedarse con el morado genérico de --primary
// para todos los "Próximamente" por igual.
export default function ProximamentePage({
  Icono,
  tituloClave,
  color,
}: {
  Icono: LucideIcon;
  tituloClave: string;
  color?: string;
}) {
  const { t } = useIdioma();
  const titulo = t(tituloClave);
  const acento = color ?? "var(--primary)";

  return (
    <main className="fade-up proximamente-page">
      <div className="card proximamente-card">
        <div className="proximamente-icono" style={color ? { background: `${color}1f` } : undefined}>
          <Icono size={30} color={acento} />
        </div>
        <span className="proximamente-badge" style={color ? { background: `${color}1f`, color: acento } : undefined}>
          {t("proximamente.badge")}
        </span>
        <h1>{titulo}</h1>
        <p>{t("proximamente.mensaje").replace("{modulo}", titulo)}</p>
      </div>
    </main>
  );
}
