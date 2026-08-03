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
  const { t, idioma } = useIdioma();
  const { mostrarToast } = useToast();
  const [guardando, setGuardando] = useState(false);
  // "otro" pide describir el negocio en vez de enviarse solo al tocarlo
  // — sin texto, la IA no tiene con qué elegir módulos.
  const [otroActivo, setOtroActivo] = useState(false);
  const [descripcionOtro, setDescripcionOtro] = useState("");

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

  async function elegir(tipo: TipoNegocio, descripcion: string) {
    if (guardando) return;
    setGuardando(true);

    try {
      await elegirTipoNegocio(tipo, descripcion, idioma);
    } catch (error) {
      console.error(error);
      mostrarToast(t("tipo_negocio.msg_error"), "error");
      setGuardando(false);
    }
  }

  function alTocar(opcion: (typeof TIPOS_NEGOCIO)[number]) {
    if (guardando) return;
    if (opcion.id === "otro") {
      setOtroActivo(true);
      return;
    }
    elegir(opcion.id, t(opcion.claveNombre));
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
                className={`tipo-negocio-card${otroActivo && opcion.id === "otro" ? " tipo-negocio-card-activa" : ""}`}
                disabled={guardando}
                onClick={() => alTocar(opcion)}
              >
                <span className="tipo-negocio-icono">
                  <Icono size={22} />
                </span>
                <span className="tipo-negocio-nombre">{t(opcion.claveNombre)}</span>
              </button>
            );
          })}
        </div>

        {otroActivo && (
          <div className="tipo-negocio-otro">
            <input
              value={descripcionOtro}
              onChange={(e) => setDescripcionOtro(e.target.value)}
              placeholder={t("tipo_negocio.otro_placeholder")}
              disabled={guardando}
              autoFocus
            />
            <button
              type="button"
              className="btn-primary"
              disabled={guardando || !descripcionOtro.trim()}
              onClick={() => elegir("otro", descripcionOtro.trim())}
            >
              {t("tipo_negocio.continuar")}
            </button>
          </div>
        )}

        {guardando && <p className="modo-inicial-nota">{t("tipo_negocio.analizando")}</p>}
        <p className="modo-inicial-nota">{t("tipo_negocio.nota")}</p>
      </div>
    </div>
  );
}
