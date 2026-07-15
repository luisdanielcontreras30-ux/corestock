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
  Camera,
  X,
} from "lucide-react";
import { useIdioma } from "./LanguageProvider";
import { useMiembroActivo } from "./MiembroActivoProvider";
import NuevaVentaModal from "../app/ventas/components/NuevaVentaModal";

export default function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useIdioma();
  const { puede } = useMiembroActivo();
  const [fabAbierto, setFabAbierto] = useState(false);
  const [ventaModalAbierto, setVentaModalAbierto] = useState(false);

  const tabs = [
    { href: "/menu", Icono: LayoutDashboard, clave: "sidebar.dashboard", color: "#6366f1" },
    { href: "/productos", Icono: Package, clave: "sidebar.productos", color: "#22c55e" },
    ...(puede("ver_ventas")
      ? [{ href: "/ventas", Icono: DollarSign, clave: "sidebar.ventas", color: "#10b981" }]
      : []),
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
      {fabAbierto && (
        <div
          className="mobile-mas-overlay"
          onClick={() => setFabAbierto(false)}
        />
      )}

      {fabAbierto && (
        <div className="mobile-fab-sheet fade-up">
          <div className="mobile-fab-sheet-header">
            <p>{t("mobile.acciones_rapidas")}</p>
            <button onClick={() => setFabAbierto(false)} aria-label={t("mobile.cerrar")}>
              <X size={16} />
            </button>
          </div>

          {puede("registrar_ventas") && (
            <button className="mobile-fab-opcion" onClick={abrirNuevaVenta}>
              <span className="mobile-fab-opcion-icono" style={{ background: "#10b981" }}>
                <DollarSign size={26} color="#fff" />
              </span>
              {t("mobile.nueva_venta")}
            </button>
          )}

          {puede("gestionar_inventario") && (
            <button className="mobile-fab-opcion" onClick={irANuevoProducto}>
              <span className="mobile-fab-opcion-icono" style={{ background: "var(--primary)" }}>
                <Camera size={26} color="#fff" />
              </span>
              {t("mobile.nuevo_producto")}
            </button>
          )}
        </div>
      )}

      {ventaModalAbierto && (
        <NuevaVentaModal onClose={() => setVentaModalAbierto(false)} />
      )}

      <nav className="mobile-tabbar">
        <div className="mobile-tabbar-lado">
          {tabs.slice(0, 2).map((tab) => {
            const Icono = tab.Icono;
            const activo = pathname === tab.href;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`mobile-tab ${activo ? "mobile-tab-activo" : ""}`}
              >
                <Icono size={21} color={activo ? "var(--primary)" : tab.color} />
                <span>{t(tab.clave)}</span>
              </Link>
            );
          })}
        </div>

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

        <div className="mobile-tabbar-lado">
          {tabs.slice(2).map((tab) => {
            const Icono = tab.Icono;
            const activo = pathname === tab.href;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`mobile-tab ${activo ? "mobile-tab-activo" : ""}`}
              >
                <Icono size={21} color={activo ? "var(--primary)" : tab.color} />
                <span>{t(tab.clave)}</span>
              </Link>
            );
          })}

          <Link
            href="/mas"
            className={`mobile-tab ${pathname === "/mas" ? "mobile-tab-activo" : ""}`}
          >
            <MenuIcon size={21} />
            <span>{t("sidebar.mas")}</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
