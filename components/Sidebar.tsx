"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIdioma } from "./LanguageProvider";
import { SECCIONES_NAV, RUTAS_PERMITIDAS_MIEMBRO, RUTAS_EASY, ItemNav } from "../lib/navegacion";
import { esRutaPlus } from "../lib/suscripcion";
import { useMiembroActivo } from "./MiembroActivoProvider";
import { useModoInterfaz } from "./ModoInterfazProvider";

export default function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { t } = useIdioma();
  const { miembroActivo, puede } = useMiembroActivo();
  const { esEasy } = useModoInterfaz();

  // En modo Easy (y solo para el dueño — un miembro del equipo ya
  // tiene su propia navegación reducida más abajo), el sidebar
  // colapsa a lo esencial, sin secciones ni categorías.
  const itemsEasy = esEasy && !miembroActivo
    ? RUTAS_EASY.map((href) =>
        SECCIONES_NAV.flatMap((s) => s.items).find((item) => item.href === href)
      ).filter((item): item is NonNullable<typeof item> => !!item)
    : null;

  function renderLink(item: ItemNav) {
    const isActive = pathname === item.href;
    const Icono = item.Icono;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        className={`sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
      >
        <Icono
          size={17}
          className="sidebar-link-icon"
          color={isActive ? "var(--primary)" : "var(--text-secondary)"}
        />
        {t(item.claveNombre)}
        {item.proximamente && (
          <span className="sidebar-link-badge">{t("proximamente.badge")}</span>
        )}
        {!item.proximamente && esRutaPlus(item.href) && (
          <span className="sidebar-link-badge-plus" title={t("plus.badge_tooltip")}>Plus+</span>
        )}
      </Link>
    );
  }

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar-v2 ${isOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <h2>
            <span className="sidebar-brand-icon">⬢</span> CoreStock
          </h2>
          <p>SISTEMA DE INVENTARIO</p>
        </div>

        <nav className="sidebar-nav">
          {itemsEasy ? (
            <div className="sidebar-section">
              {itemsEasy.map((item) => renderLink(item))}
            </div>
          ) : (
            SECCIONES_NAV.map((seccion) => {
              const itemsVisibles = seccion.items.filter((item) => {
                if (miembroActivo && !RUTAS_PERMITIDAS_MIEMBRO.includes(item.href)) return false;
                // Un miembro del equipo sin permiso "ver_ventas" no ve
                // ese acceso en el menú (la página también lo bloquea).
                if (item.href === "/ventas" && !puede("ver_ventas")) return false;
                if (item.href === "/ventas-rapidas" && !puede("registrar_ventas")) return false;
                return true;
              });

              if (itemsVisibles.length === 0) return null;

              return (
                <div key={seccion.claveTitulo} className="sidebar-section">
                  <p className="sidebar-section-title">{t(seccion.claveTitulo)}</p>
                  {itemsVisibles.map((item) => renderLink(item))}
                </div>
              );
            })
          )}
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-footer-text">CoreStock v2</p>
        </div>
      </aside>
    </>
  );
}
