"use client";

import React, { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  // La pantalla de login/registro y la de bienvenida se muestran solas,
  // sin sidebar ni header.
  const esPantallaPublica =
    pathname === "/login" || pathname === "/bienvenida";

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
    </div>
  );
}
