"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  DollarSign,
  Package,
  Menu as MenuIcon,
  BarChart3,
  Bell,
  Sparkles,
  Settings,
  Truck,
  X,
} from "lucide-react";
import { useIdioma } from "./LanguageProvider";

export default function MobileTabBar() {
  const pathname = usePathname();
  const { t } = useIdioma();
  const [masAbierto, setMasAbierto] = useState(false);

  const tabs = [
    { href: "/menu", Icono: LayoutDashboard, clave: "sidebar.dashboard" },
    { href: "/productos", Icono: Package, clave: "sidebar.productos" },
  ];

  // "Ventas" (que ya incluye el formulario de nueva venta) y el resto
  // de secciones viven solo dentro de "Más" en celular.
  const masItems = [
    { href: "/ventas", Icono: DollarSign, clave: "sidebar.ventas" },
    { href: "/graficas", Icono: BarChart3, clave: "sidebar.graficas" },
    { href: "/proveedores", Icono: Truck, clave: "sidebar.proveedores" },
    { href: "/alertas", Icono: Bell, clave: "sidebar.alertas" },
    { href: "/asistente", Icono: Sparkles, clave: "sidebar.asistente" },
    { href: "/configuracion", Icono: Settings, clave: "sidebar.configuracion" },
  ];

  return (
    <>
      {masAbierto && (
        <div
          className="mobile-mas-overlay"
          onClick={() => setMasAbierto(false)}
        />
      )}

      {masAbierto && (
        <div className="mobile-mas-sheet fade-up">
          <div className="mobile-mas-sheet-header">
            <p>{t("sidebar.mas_opciones")}</p>
            <button onClick={() => setMasAbierto(false)} aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>

          {masItems.map((item) => {
            const Icono = item.Icono;
            const activo = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMasAbierto(false)}
                className={`mobile-mas-item ${activo ? "mobile-mas-item-activo" : ""}`}
              >
                <Icono size={18} />
                {t(item.clave)}
              </Link>
            );
          })}
        </div>
      )}

      <nav className="mobile-tabbar">
        {tabs.map((tab) => {
          const Icono = tab.Icono;
          const activo = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`mobile-tab ${activo ? "mobile-tab-activo" : ""}`}
            >
              <Icono size={21} />
              <span>{t(tab.clave)}</span>
            </Link>
          );
        })}

        <button
          className={`mobile-tab ${masAbierto ? "mobile-tab-activo" : ""}`}
          onClick={() => setMasAbierto((v) => !v)}
        >
          <MenuIcon size={21} />
          <span>{t("sidebar.mas")}</span>
        </button>
      </nav>
    </>
  );
}
