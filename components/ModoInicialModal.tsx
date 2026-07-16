"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { useIdioma } from "./LanguageProvider";
import { useToast } from "./ToastProvider";
import { useModoInterfaz, ModoInterfaz } from "./ModoInterfazProvider";
import SelectorModoInterfaz from "./SelectorModoInterfaz";

// Pantalla de bienvenida "¿Cómo quieres usar CoreStock?" — se muestra
// una sola vez, antes del tutorial, a cualquier cuenta que todavía no
// eligió modo_interfaz (ver ModoInterfazProvider). No tiene botón de
// cerrar a propósito: es una decisión de una sola pantalla, pero la
// nota de abajo deja claro que no es permanente.
export default function ModoInicialModal() {
  const { user, cargando: cargandoAuth } = useAuth();
  const { modoInterfaz, cargando: cargandoModo, cambiarModo } = useModoInterfaz();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const [guardando, setGuardando] = useState<ModoInterfaz | null>(null);

  const debeMostrarse =
    !cargandoAuth && !!user && !cargandoModo && modoInterfaz === null;

  if (!debeMostrarse) return null;

  async function elegir(modo: ModoInterfaz) {
    if (guardando) return;
    setGuardando(modo);

    try {
      await cambiarModo(modo);
    } catch (error) {
      console.error(error);
      mostrarToast(t("modo_interfaz.msg_error"), "error");
      setGuardando(null);
    }
  }

  return (
    <div className="modo-inicial-overlay">
      <div className="modo-inicial-contenido fade-up">
        <h1 className="modo-inicial-titulo">{t("modo_interfaz.titulo")}</h1>

        <SelectorModoInterfaz
          valorActual={null}
          guardando={guardando}
          onElegir={elegir}
        />

        <p className="modo-inicial-nota">{t("modo_interfaz.nota")}</p>
      </div>
    </div>
  );
}
