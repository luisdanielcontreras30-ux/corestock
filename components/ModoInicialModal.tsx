"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { useIdioma } from "./LanguageProvider";
import { useToast } from "./ToastProvider";
import { useModoInterfaz, ModoInterfaz } from "./ModoInterfazProvider";
import { useMiembroActivo } from "./MiembroActivoProvider";
import { useTipoNegocio } from "./TipoNegocioProvider";
import SelectorModoInterfaz from "./SelectorModoInterfaz";
import { supabase } from "../lib/supabase";

// Pantalla de bienvenida "¿Cómo quieres usar CoreStock?" — se muestra
// una sola vez, DESPUÉS de SeleccionNegocioModal (¿qué tipo de negocio
// tienes?) y antes del tutorial, a cualquier cuenta que todavía no
// eligió modo_interfaz (ver ModoInterfazProvider). No tiene botón de
// cerrar a propósito: es una decisión de una sola pantalla, pero la
// nota de abajo deja claro que no es permanente.
export default function ModoInicialModal() {
  const { user, cargando: cargandoAuth } = useAuth();
  const { modoInterfaz, cargando: cargandoModo, cambiarModo } = useModoInterfaz();
  const { miembroActivo, cargando: cargandoMiembro, limpiarMiembroActivo } = useMiembroActivo();
  const { tipoNegocio, cargando: cargandoTipoNegocio } = useTipoNegocio();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const [guardando, setGuardando] = useState<ModoInterfaz | null>(null);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  // Un miembro del equipo entra con la misma sesión (mismo user.id) del
  // dueño de la cuenta — sin este chequeo, si el dueño todavía no había
  // elegido modo_interfaz, cualquier miembro quedaba atrapado en esta
  // pantalla sin poder llegar a su panel restringido, y su elección
  // sobrescribía la del dueño para toda la cuenta (cambiarModo() guarda
  // por user.id, no por miembro).
  //
  // tipoNegocio !== null espera a que SeleccionNegocioModal ya haya
  // resuelto su propia pregunta primero — sin esto, las dos pantallas
  // de bienvenida podrían mostrarse a la vez.
  const debeMostrarse =
    !cargandoAuth &&
    !!user &&
    !cargandoModo &&
    !cargandoMiembro &&
    !cargandoTipoNegocio &&
    !miembroActivo &&
    tipoNegocio !== null &&
    modoInterfaz === null;

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

  // Mismo motivo que en SeleccionNegocioModal: sin esta salida, si
  // guardar la elección falla repetidamente no hay forma de recuperarse
  // sin borrar a mano los datos del sitio en el navegador.
  async function cerrarSesion() {
    if (cerrandoSesion) return;
    setCerrandoSesion(true);

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error(error);
    } finally {
      limpiarMiembroActivo();
      window.location.href = "/login";
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

        <button
          type="button"
          className="modo-inicial-salir"
          disabled={!!guardando || cerrandoSesion}
          onClick={cerrarSesion}
        >
          {t("header.cerrar_sesion")}
        </button>
      </div>
    </div>
  );
}
