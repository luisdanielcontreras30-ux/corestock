"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Package,
  Bell,
  DollarSign,
  Settings,
  Sparkles,
  LucideIcon,
} from "lucide-react";
import { useIdioma } from "./LanguageProvider";

interface ItemNav {
  claveNombre: string;
  href: string;
  Icono: LucideIcon;
}

interface Seccion {
  claveTitulo: string;
  items: ItemNav[];
}

const secciones: Seccion[] = [
  {
    claveTitulo: "sidebar.principal",
    items: [
      { claveNombre: "sidebar.dashboard", href: "/menu", Icono: LayoutDashboard },
      { claveNombre: "sidebar.graficas", href: "/graficas", Icono: BarChart3 },
      { claveNombre: "sidebar.asistente", href: "/asistente", Icono: Sparkles },
    ],
  },
  {
    claveTitulo: "sidebar.inventario",
    items: [
      { claveNombre: "sidebar.productos", href: "/productos", Icono: Package },
      { claveNombre: "sidebar.alertas", href: "/alertas", Icono: Bell },
    ],
  },
  {
    claveTitulo: "sidebar.operaciones",
    items: [
      { claveNombre: "sidebar.ventas", href: "/ventas", Icono: DollarSign },
    ],
  },
  {
    claveTitulo: "sidebar.sistema",
    items: [
      { claveNombre: "sidebar.configuracion", href: "/configuracion", Icono: Settings },
    ],
  },
];

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
          {secciones.map((seccion) => (
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
