"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";
import { useToast } from "../../../components/ToastProvider";
import { useTipoNegocio } from "../../../components/TipoNegocioProvider";
import { useModoInterfaz } from "../../../components/ModoInterfazProvider";
import { SECCIONES_NAV } from "../../../lib/navegacion";
import { TIPOS_NEGOCIO, RUTAS_SIEMPRE_VISIBLES, TipoNegocio } from "../../../lib/tiposNegocio";

// Todos los accesos que la personalización puede prender/apagar: todo
// lo de SECCIONES_NAV menos lo que siempre se ve (navegación/cuenta,
// ver RUTAS_SIEMPRE_VISIBLES) y lo que todavía no tiene funcionalidad
// real (no tiene sentido ocultar algo que ya está oculto detrás de
// "Próximamente").
const MODULOS_PERSONALIZABLES = SECCIONES_NAV.flatMap((s) => s.items).filter(
  (item) => !RUTAS_SIEMPRE_VISIBLES.includes(item.href) && !item.proximamente
);

export default function PersonalizacionTab() {
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { modoInterfaz } = useModoInterfaz();
  const {
    tipoNegocio,
    rutasActivas,
    cargando,
    actualizarTipoNegocio,
    actualizarRutasActivas,
  } = useTipoNegocio();
  const [guardandoTipo, setGuardandoTipo] = useState(false);
  const [guardandoRuta, setGuardandoRuta] = useState<string | null>(null);

  // rutasActivas === null significa "sin personalizar" — para la
  // grilla de checkboxes eso equivale a que todo esté marcado, mismo
  // criterio que usa Sidebar para decidir qué mostrar.
  const activas = useMemo(
    () => rutasActivas ?? MODULOS_PERSONALIZABLES.map((m) => m.href),
    [rutasActivas]
  );

  async function cambiarTipo(tipo: TipoNegocio) {
    if (guardandoTipo || tipo === tipoNegocio) return;
    setGuardandoTipo(true);
    try {
      await actualizarTipoNegocio(tipo);
    } catch (error) {
      console.error(error);
      mostrarToast(t("tipo_negocio.msg_error"), "error");
    } finally {
      setGuardandoTipo(false);
    }
  }

  async function alternar(href: string) {
    if (guardandoRuta) return;
    const nuevas = activas.includes(href)
      ? activas.filter((r) => r !== href)
      : [...activas, href];
    setGuardandoRuta(href);
    try {
      await actualizarRutasActivas(nuevas);
    } catch (error) {
      console.error(error);
      mostrarToast(t("tipo_negocio.msg_error"), "error");
    } finally {
      setGuardandoRuta(null);
    }
  }

  if (cargando) return null;

  return (
    <>
      <div className="card">
        <h2 style={{ marginBottom: 6 }}>{t("personalizacion.tipo_negocio_titulo")}</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 20, fontSize: 13 }}>
          {t("personalizacion.tipo_negocio_subtitulo")}
        </p>

        <div className="personalizacion-tipos">
          {TIPOS_NEGOCIO.map((opcion) => {
            const Icono = opcion.Icono;
            const activo = tipoNegocio === opcion.id;
            return (
              <button
                key={opcion.id}
                type="button"
                className={`personalizacion-tipo-chip${activo ? " personalizacion-tipo-chip-activo" : ""}`}
                disabled={guardandoTipo}
                onClick={() => cambiarTipo(opcion.id)}
              >
                <Icono size={15} />
                {t(opcion.claveNombre)}
              </button>
            );
          })}
        </div>

        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "16px 0 0" }}>
          {t("personalizacion.modo_actual")}{" "}
          <strong>
            {modoInterfaz === "easy" ? t("modo_interfaz.easy_nombre") : t("modo_interfaz.completo_nombre")}
          </strong>
          {" — "}
          {t("personalizacion.modo_nota")}
        </p>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 6 }}>{t("personalizacion.funciones_titulo")}</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 20, fontSize: 13 }}>
          {t("personalizacion.funciones_subtitulo")}
        </p>

        <div className="personalizacion-checks">
          {MODULOS_PERSONALIZABLES.map((modulo) => {
            const marcado = activas.includes(modulo.href);
            return (
              <button
                key={modulo.href}
                type="button"
                className={`personalizacion-check${marcado ? " personalizacion-check-marcado" : ""}`}
                disabled={guardandoRuta === modulo.href}
                onClick={() => alternar(modulo.href)}
              >
                <span className="personalizacion-check-caja">
                  {marcado && <Check size={13} />}
                </span>
                {t(modulo.claveNombre)}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
