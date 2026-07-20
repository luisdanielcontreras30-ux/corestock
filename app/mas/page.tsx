"use client";

import Link from "next/link";
import { useIdioma } from "../../components/LanguageProvider";
import { useModoInterfaz } from "../../components/ModoInterfazProvider";
import { useAuth } from "../../components/AuthProvider";
import { SECCIONES_NAV, RUTAS_EN_TABBAR_MOVIL } from "../../lib/navegacion";
import { esRutaPlus } from "../../lib/suscripcion";
import { esRutaBetaCerrada, tieneAccesoBeta } from "../../lib/betaAcceso";

export default function MasPage() {
  const { t } = useIdioma();
  const { user } = useAuth();
  const { esEasy } = useModoInterfaz();

  // En modo Easy, la barra inferior cambia "/ventas" por "/caja" (ver
  // MobileTabBar) — sin este ajuste, Caja aparecía repetida (fija en
  // la barra Y como tarjeta aquí) porque RUTAS_EN_TABBAR_MOVIL no sabe
  // de ese cambio.
  const rutasEnTabbar = esEasy
    ? RUTAS_EN_TABBAR_MOVIL.map((r) => (r === "/ventas" ? "/caja" : r))
    : RUTAS_EN_TABBAR_MOVIL;

  return (
    <main className="fade-up mas-page">
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 700 }}>{t("sidebar.mas_opciones")}</h1>
        <p style={{ color: "var(--text-secondary)" }}>{t("mas.subtitulo")}</p>
      </div>

      {SECCIONES_NAV.map((seccion) => {
        const items = seccion.items.filter(
          (item) =>
            !rutasEnTabbar.includes(item.href) &&
            (!esRutaBetaCerrada(item.href) || tieneAccesoBeta(user?.email))
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
                    <span
                      className="mas-card-icono"
                      style={{ background: `${item.colorMovil}22` }}
                    >
                      <Icono size={20} color={item.colorMovil} />
                    </span>
                    {t(item.claveNombre)}
                    {item.proximamente && (
                      <span className="mas-card-badge">{t("proximamente.badge")}</span>
                    )}
                    {!item.proximamente && esRutaPlus(item.href) && (
                      <span className="mas-card-badge-plus" title={t("plus.badge_tooltip")}>Plus+</span>
                    )}
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
