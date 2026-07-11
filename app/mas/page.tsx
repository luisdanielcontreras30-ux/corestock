"use client";

import Link from "next/link";
import { useIdioma } from "../../components/LanguageProvider";
import { SECCIONES_NAV, RUTAS_EN_TABBAR_MOVIL } from "../../lib/navegacion";

export default function MasPage() {
  const { t } = useIdioma();

  return (
    <main className="fade-up mas-page">
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 700 }}>{t("sidebar.mas_opciones")}</h1>
        <p style={{ color: "var(--text-secondary)" }}>{t("mas.subtitulo")}</p>
      </div>

      {SECCIONES_NAV.map((seccion) => {
        const items = seccion.items.filter(
          (item) => !RUTAS_EN_TABBAR_MOVIL.includes(item.href)
        );

        if (items.length === 0) return null;

        return (
          <div key={seccion.claveTitulo} className="mas-seccion">
            <p className="mas-seccion-titulo">{t(seccion.claveTitulo)}</p>

            <div className="mas-grid">
              {items.map((item) => {
                const Icono = item.Icono;

                return (
                  <Link key={item.href} href={item.href} className="mas-card">
                    <span className="mas-card-icono">
                      <Icono size={20} color="var(--primary)" />
                    </span>
                    {t(item.claveNombre)}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </main>
  );
}
