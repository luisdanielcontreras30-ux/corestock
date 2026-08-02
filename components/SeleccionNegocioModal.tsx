"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { useIdioma } from "./LanguageProvider";
import { useToast } from "./ToastProvider";
import { useTipoNegocio } from "./TipoNegocioProvider";
import { useMiembroActivo } from "./MiembroActivoProvider";
import { TIPOS_NEGOCIO, TipoNegocio } from "../lib/tiposNegocio";

// Pantalla de bienvenida "¿Qué tipo de negocio tienes?" — se muestra
// una sola vez, ANTES de ModoInicialModal (¿Easy o Completo?) y del
// tutorial, a cualquier cuenta que todavía no eligió tipo_negocio (ver
// TipoNegocioProvider). Mismo patrón que ModoInicialModal: sin botón
// de cerrar, una sola decisión, pero no es permanente — se puede
// cambiar después en Configuración > Personalización.
export default function SeleccionNegocioModal() {
  const { user, cargando: cargandoAuth } = useAuth();
  const { tipoNegocio, cargando: cargandoTipo, elegirTipoNegocio } = useTipoNegocio();
  const { miembroActivo, cargando: cargandoMiembro } = useMiembroActivo();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const [guardando, setGuardando] = useState<TipoNegocio | null>(null);

  // Mismo motivo que en ModoInicialModal: un miembro del equipo no
  // debe quedar atrapado eligiendo por el dueño de la cuenta.
  const debeMostrarse =
    !cargandoAuth &&
    !!user &&
    !cargandoTipo &&
    !cargandoMiembro &&
    !miembroActivo &&
    tipoNegocio === null;

  if (!debeMostrarse) return null;

  async function elegir(tipo: TipoNegocio) {
    if (guardando) return;
    setGuardando(tipo);

    try {
      await elegirTipoNegocio(tipo);
    } catch (error) {
      console.error(error);
      mostrarToast(t("tipo_negocio.msg_error"), "error");
      setGuardando(null);
    }
  }

  return (
    <div className="modo-inicial-overlay">
      <div className="modo-inicial-contenido fade-up">
        <h1 className="modo-inicial-titulo">{t("tipo_negocio.titulo")}</h1>

        <div className="tipo-negocio-grid">
          {TIPOS_NEGOCIO.map((opcion) => {
            const Icono = opcion.Icono;
            return (
              <button
                key={opcion.id}
                type="button"
                className="tipo-negocio-card"
                disabled={guardando !== null}
                onClick={() => elegir(opcion.id)}
              >
                <span className="tipo-negocio-icono">
                  <Icono size={22} />
                </span>
                <span className="tipo-negocio-nombre">
                  {guardando === opcion.id ? t("tipo_negocio.guardando") : t(opcion.claveNombre)}
                </span>
              </button>
            );
          })}
        </div>

        <p className="modo-inicial-nota">{t("tipo_negocio.nota")}</p>
      </div>
    </div>
  );
}
