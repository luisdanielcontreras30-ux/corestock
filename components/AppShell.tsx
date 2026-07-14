"use client";

import React, { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import MobileTabBar from "./MobileTabBar";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  // La pantalla de login/registro, la de bienvenida y el catálogo
  // público (sin sesión) se muestran solas, sin sidebar ni header.
  const esPantallaPublica =
    pathname === "/login" ||
    pathname === "/bienvenida" ||
    pathname.startsWith("/catalogo/");

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
          {children}
        </div>
      </div>

      <MobileTabBar />
    </div>
  );
}
