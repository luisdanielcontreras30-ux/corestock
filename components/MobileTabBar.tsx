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
  Zap,
  X,
  Inbox,
} from "lucide-react";
import { useIdioma } from "./LanguageProvider";
import { useMiembroActivo } from "./MiembroActivoProvider";
import { useModoInterfaz } from "./ModoInterfazProvider";

export default function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useIdioma();
  const { miembroActivo, puede } = useMiembroActivo();
  const { esEasy } = useModoInterfaz();
  const [fabAbierto, setFabAbierto] = useState(false);

  // En modo Easy, "Caja" reemplaza a "Ventas" en la barra — vender de
  // verdad ya vive en el botón central (+), y Caja es uno de los
  // cuatro destinos principales de este modo.
  const tabs = [
    { href: "/menu", Icono: LayoutDashboard, clave: "sidebar.dashboard", color: "#6366f1" },
    { href: "/productos", Icono: Package, clave: "sidebar.productos", color: "#22c55e" },
    ...(esEasy
      ? [{ href: "/caja", Icono: Inbox, clave: "sidebar.caja", color: "#84cc16" }]
      : puede("ver_ventas")
      ? [{ href: "/ventas", Icono: DollarSign, clave: "sidebar.ventas", color: "#10b981" }]
      : []),
  ];

  function irAVentaRapida() {
    setFabAbierto(false);
    router.push("/ventas-rapidas");
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
            <button className="mobile-fab-opcion" onClick={irAVentaRapida}>
              <span className="mobile-fab-opcion-icono" style={{ background: "#10b981" }}>
                <Zap size={26} color="#fff" />
              </span>
              {t("mobile.venta_rapida")}
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

      <nav className="mobile-tabbar">
        <div className="mobile-tabbar-lado">
          {/* Un miembro del equipo navega desde el dashboard simple,
              no desde esta barra — solo ve el "+" del centro. */}
          {!miembroActivo && tabs.slice(0, 2).map((tab) => {
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
          {!miembroActivo && tabs.slice(2).map((tab) => {
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

          {!miembroActivo && (
            <Link
              href="/mas"
              className={`mobile-tab ${pathname === "/mas" ? "mobile-tab-activo" : ""}`}
            >
              <MenuIcon size={21} />
              <span>{t("sidebar.mas")}</span>
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
