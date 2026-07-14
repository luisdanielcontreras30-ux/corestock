"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { Crown } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useSuscripcion } from "./SuscripcionProvider";
import { useIdioma } from "./LanguageProvider";
import { iniciarCheckoutPlus } from "../lib/suscripcionAcciones";

// Envuelve el contenido de un módulo exclusivo de CoreStock Plus+. Si
// el negocio no tiene el plan Plus+, muestra un aviso con enlace para
// suscribirse en vez del contenido real.
export default function RequierePlus({ children }: { children: ReactNode }) {
  const { user, cargando: cargandoAuth } = useAuth();
  const { esPlus, cargando } = useSuscripcion();
  const { t } = useIdioma();
  const [procesando, setProcesando] = useState(false);

  async function alContratar() {
    if (procesando) return;
    setProcesando(true);

    try {
      const url = await iniciarCheckoutPlus();
      window.location.href = url;
    } catch (error) {
      console.error(error);
      const detalle = error instanceof Error ? error.message : "";
      alert(detalle || t("plus.msg_error_checkout"));
      setProcesando(false);
    }
  }

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

          <button
            className="btn-primary plus-requerido-boton"
            onClick={alContratar}
            disabled={procesando}
          >
            {procesando ? t("plus.procesando") : t("plus.boton_contratar")}
          </button>

          <Link href="/suscripcion" className="plus-requerido-link">
            {t("plus.boton_ver_planes")}
          </Link>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
