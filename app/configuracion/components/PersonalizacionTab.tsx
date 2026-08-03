"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";
import { useToast } from "../../../components/ToastProvider";
import { useConfirm } from "../../../components/ConfirmProvider";
import { useTipoNegocio } from "../../../components/TipoNegocioProvider";
import { useModoInterfaz } from "../../../components/ModoInterfazProvider";
import { TIPOS_NEGOCIO, MODULOS_PERSONALIZABLES, TipoNegocio } from "../../../lib/tiposNegocio";

export default function PersonalizacionTab() {
  const { t, idioma } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();
  const { modoInterfaz } = useModoInterfaz();
  const { tipoNegocio, rutasActivas, cargando, elegirTipoNegocio, actualizarRutasActivas } =
    useTipoNegocio();
  const [guardandoTipo, setGuardandoTipo] = useState(false);
  const [guardandoRuta, setGuardandoRuta] = useState<string | null>(null);
  // "otro" pide describir el negocio en vez de aplicarse solo al
  // tocarlo — sin texto, la IA no tiene con qué elegir módulos.
  const [otroActivo, setOtroActivo] = useState(false);
  const [descripcionOtro, setDescripcionOtro] = useState("");

  // rutasActivas === null significa "sin personalizar" — para la
  // grilla de checkboxes eso equivale a que todo esté marcado, mismo
  // criterio que usa Sidebar para decidir qué mostrar.
  const activas = useMemo(
    () => rutasActivas ?? MODULOS_PERSONALIZABLES.map((m) => m.href),
    [rutasActivas]
  );

  async function cambiarTipo(tipo: TipoNegocio, descripcion: string) {
    // "otro" es la excepción: aunque el tipo (id) siga siendo el
    // mismo, la persona puede estar cambiando la DESCRIPCIÓN de su
    // negocio para pedirle a la IA una recomendación distinta — si se
    // bloqueara igual que los demás tipos, tocar "Continuar" con un
    // texto nuevo no hacía nada cuando ya se había elegido "otro"
    // antes.
    if (guardandoTipo || (tipo === tipoNegocio && tipo !== "otro")) return;

    // Cambiar el tipo de negocio le pide a la IA una recomendación
    // nueva y REEMPLAZA rutas_activas — si la persona ya personalizó
    // sus accesos a mano, eso se pierde, así que se avisa antes.
    if (!(await confirmar(t("personalizacion.confirmar_cambio_tipo")))) return;

    setGuardandoTipo(true);
    try {
      await elegirTipoNegocio(tipo, descripcion, idioma);
      setOtroActivo(false);
      setDescripcionOtro("");
    } catch (error) {
      console.error(error);
      mostrarToast(t("tipo_negocio.msg_error"), "error");
    } finally {
      setGuardandoTipo(false);
    }
  }

  function alTocarTipo(opcion: (typeof TIPOS_NEGOCIO)[number]) {
    if (guardandoTipo) return;
    if (opcion.id === "otro") {
      setOtroActivo(true);
      return;
    }
    cambiarTipo(opcion.id, t(opcion.claveNombre));
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
                onClick={() => alTocarTipo(opcion)}
              >
                <Icono size={15} />
                {t(opcion.claveNombre)}
              </button>
            );
          })}
        </div>

        {otroActivo && (
          <div className="tipo-negocio-otro" style={{ marginTop: 12 }}>
            <input
              value={descripcionOtro}
              onChange={(e) => setDescripcionOtro(e.target.value)}
              placeholder={t("tipo_negocio.otro_placeholder")}
              disabled={guardandoTipo}
              autoFocus
            />
            <button
              type="button"
              className="btn-primary"
              disabled={guardandoTipo || !descripcionOtro.trim()}
              onClick={() => cambiarTipo("otro", descripcionOtro.trim())}
            >
              {t("tipo_negocio.continuar")}
            </button>
          </div>
        )}

        {guardandoTipo && (
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "12px 0 0" }}>
            {t("tipo_negocio.analizando")}
          </p>
        )}

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
