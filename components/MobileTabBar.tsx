"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  DollarSign,
  Package,
  Plus,
  Menu as MenuIcon,
  BarChart3,
  Bell,
  Sparkles,
  Settings,
  Truck,
  Users,
  Camera,
  X,
} from "lucide-react";
import { useIdioma } from "./LanguageProvider";
import NuevaVentaModal from "../app/ventas/components/NuevaVentaModal";

export default function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useIdioma();
  const [masAbierto, setMasAbierto] = useState(false);
  const [fabAbierto, setFabAbierto] = useState(false);
  const [ventaModalAbierto, setVentaModalAbierto] = useState(false);

  const tabs = [
    { href: "/menu", Icono: LayoutDashboard, clave: "sidebar.dashboard" },
    { href: "/ventas", Icono: DollarSign, clave: "sidebar.ventas" },
    { href: "/productos", Icono: Package, clave: "sidebar.productos" },
  ];

  const masItems = [
    { href: "/clientes", Icono: Users, clave: "sidebar.clientes" },
    { href: "/graficas", Icono: BarChart3, clave: "sidebar.graficas" },
    { href: "/proveedores", Icono: Truck, clave: "sidebar.proveedores" },
    { href: "/alertas", Icono: Bell, clave: "sidebar.alertas" },
    { href: "/asistente", Icono: Sparkles, clave: "sidebar.asistente" },
    { href: "/configuracion", Icono: Settings, clave: "sidebar.configuracion" },
  ];

  function abrirNuevaVenta() {
    setFabAbierto(false);
    setVentaModalAbierto(true);
  }

  function irANuevoProducto() {
    setFabAbierto(false);
    // El parámetro le dice a la página de Productos que abra
    // la cámara automáticamente para tomar la foto del producto.
    router.push("/productos?camara=1");
  }

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

      {fabAbierto && (
        <div
          className="mobile-mas-overlay"
          onClick={() => setFabAbierto(false)}
        />
      )}

      {fabAbierto && (
        <div className="mobile-fab-sheet fade-up">
          <button className="mobile-fab-opcion" onClick={abrirNuevaVenta}>
            <span className="mobile-fab-opcion-icono" style={{ background: "#10b981" }}>
              <DollarSign size={18} color="#fff" />
            </span>
            {t("mobile.nueva_venta")}
          </button>

          <button className="mobile-fab-opcion" onClick={irANuevoProducto}>
            <span className="mobile-fab-opcion-icono" style={{ background: "var(--primary)" }}>
              <Camera size={18} color="#fff" />
            </span>
            {t("mobile.nuevo_producto")}
          </button>
        </div>
      )}

      {ventaModalAbierto && (
        <NuevaVentaModal onClose={() => setVentaModalAbierto(false)} />
      )}

      <nav className="mobile-tabbar">
        {tabs.slice(0, 2).map((tab) => {
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
          className="mobile-tab-fab"
          aria-label={t("mobile.acciones_rapidas")}
          onClick={() => setFabAbierto((v) => !v)}
        >
          <Plus
            size={24}
            color="#fff"
            style={{
              transform: fabAbierto ? "rotate(45deg)" : "none",
              transition: "transform .2s ease",
            }}
          />
        </button>

        {tabs.slice(2).map((tab) => {
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
