"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIdioma } from "./LanguageProvider";
import { SECCIONES_NAV } from "../lib/navegacion";
import { esRutaPlus } from "../lib/suscripcion";

export default function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { t } = useIdioma();

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
          {SECCIONES_NAV.map((seccion) => (
            <div key={seccion.claveTitulo} className="sidebar-section">
              <p className="sidebar-section-title">{t(seccion.claveTitulo)}</p>

              {seccion.items.map((item) => {
                const isActive = pathname === item.href;
                const Icono = item.Icono;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`sidebar-link ${
                      isActive ? "sidebar-link-active" : ""
                    }`}
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
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-footer-text">CoreStock v2</p>
        </div>
      </aside>
    </>
  );
}
