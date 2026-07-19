"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import MobileTabBar from "./MobileTabBar";
import TutorialInicioModal from "./TutorialInicioModal";
import ModoInicialModal from "./ModoInicialModal";
import { useMiembroActivo } from "./MiembroActivoProvider";
import { useModoInterfaz } from "./ModoInterfazProvider";
import { RUTAS_PERMITIDAS_MIEMBRO } from "../lib/navegacion";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { miembroActivo, puede, cargando: cargandoMiembro } = useMiembroActivo();
  const { modoInterfaz, cargando: cargandoModo } = useModoInterfaz();
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
  // regresa al dashboard en vez de mostrarle esa pantalla. Configuración
  // es la excepción: el dueño puede darle ese permiso puntual a un
  // miembro (checkbox "Acceso a configuración" en Usuarios), así que se
  // permite además cuando puede("configuracion") es verdadero.
  const rutaPermitida =
    !miembroActivo ||
    esPantallaPublica ||
    RUTAS_PERMITIDAS_MIEMBRO.some((r) => pathname === r || pathname.startsWith(`${r}/`)) ||
    (puede("configuracion") && (pathname === "/configuracion" || pathname.startsWith("/configuracion/")));

  // Mientras todavía no se sabe si esta sesión tiene un miembro activo
  // (justo después de recargar la página, por ejemplo), no se monta el
  // contenido: si no se esperara, una ruta prohibida podría alcanzar a
  // renderizar brevemente antes de que este efecto la redirija.
  const mostrarContenido = !cargandoMiembro && rutaPermitida;

  useEffect(() => {
    if (!cargandoMiembro && !rutaPermitida) {
      router.replace("/menu");
    }
  }, [cargandoMiembro, rutaPermitida, router]);

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
          {mostrarContenido ? children : null}
        </div>
      </div>

      <MobileTabBar />
      {/* El tutorial general solo se evalúa una vez que ya se sabe el
          modo de interfaz — si no, alguien que todavía no eligió podría
          ver el tutorial completo (o incluso las dos pantallas a la
          vez) antes de responder "¿Cómo quieres usar CoreStock?". */}
      {!cargandoModo && modoInterfaz !== null && <TutorialInicioModal />}
      <ModoInicialModal />
    </div>
  );
}
