"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Crown } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useSuscripcion } from "./SuscripcionProvider";
import { useIdioma } from "./LanguageProvider";

// Envuelve el contenido de un módulo exclusivo de CoreStock Plus+. Si
// el negocio no tiene el plan Plus+, muestra un aviso con enlace para
// suscribirse en vez del contenido real.
export default function RequierePlus({ children }: { children: ReactNode }) {
  const { user, cargando: cargandoAuth } = useAuth();
  const { esPlus, cargando } = useSuscripcion();
  const { t } = useIdioma();

  // Sin sesión, dejamos que la página envuelta maneje su propio
  // redirect a /login en vez de mostrarle el aviso de Plus+ a alguien
  // que ni siquiera ha iniciado sesión.
  if (cargandoAuth || !user) {
    return <>{children}</>;
  }

  if (cargando) {
    return (
      <main className="fade-up">
        <div className="card">{t("header.cargando")}</div>
      </main>
    );
  }

  if (!esPlus) {
    return (
      <main className="fade-up plus-requerido-page">
        <div className="card plus-requerido-card">
          <div className="plus-requerido-icono">
            <Crown size={30} color="#f59e0b" />
          </div>
          <span className="plus-requerido-badge">CoreStock Plus+</span>
          <h1>{t("plus.titulo")}</h1>
          <p>{t("plus.mensaje")}</p>
          <Link href="/suscripcion" className="btn-primary plus-requerido-boton">
            {t("plus.boton_ver_planes")}
          </Link>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
