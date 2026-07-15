"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import MobileTabBar from "./MobileTabBar";
import TutorialInicioModal from "./TutorialInicioModal";
import { useMiembroActivo } from "./MiembroActivoProvider";
import { RUTAS_PERMITIDAS_MIEMBRO } from "../lib/navegacion";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { miembroActivo } = useMiembroActivo();
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  // La pantalla de login/registro, la de bienvenida, el catálogo
  // público y el portal de cada cliente (todas sin sesión) se
  // muestran solas, sin sidebar ni header.
  const esPantallaPublica =
    pathname === "/login" ||
    pathname === "/bienvenida" ||
    pathname.startsWith("/catalogo/") ||
    pathname.startsWith("/portal-clientes/");

  // Un miembro del equipo solo puede navegar a Dashboard/Caja/Ventas/
  // Productos — cualquier otra URL (aunque no aparezca en el menú) lo
  // regresa al dashboard en vez de mostrarle esa pantalla.
  const rutaPermitida =
    !miembroActivo ||
    esPantallaPublica ||
    RUTAS_PERMITIDAS_MIEMBRO.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  useEffect(() => {
    if (!rutaPermitida) {
      router.replace("/menu");
    }
  }, [rutaPermitida, router]);

  if (esPantallaPublica) {
    return <>{children}</>;
  }

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={sidebarAbierto}
        onClose={() => setSidebarAbierto(false)}
      />

      <div className="main-content">
        <Header
          onToggleSidebar={() => setSidebarAbierto((v) => !v)}
        />

        <div className="page-content fade-up" key={pathname}>
          {rutaPermitida ? children : null}
        </div>
      </div>

      <MobileTabBar />
      <TutorialInicioModal />
    </div>
  );
}
