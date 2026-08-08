"use client";

import { useState } from "react";
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { useSync } from "./SyncProvider";
import { useIdioma } from "./LanguageProvider";
import PanelErroresSync from "./PanelErroresSync";

// Indicador global de conexión/sincronización: siempre visible en el
// encabezado para que quien está vendiendo sepa, de un vistazo, si lo
// que está haciendo se está guardando en línea o va a quedar en la
// cola local hasta que vuelva Internet.
export default function IndicadorSincronizacion() {
  const { estado, pendientes, conError, sincronizarAhora } = useSync();
  const { t } = useIdioma();
  const [panelAbierto, setPanelAbierto] = useState(false);

  const config = {
    sin_conexion: {
      Icono: WifiOff,
      clase: "sync-indicador-rojo",
      texto: t("sync.sin_conexion"),
    },
    sincronizando: {
      Icono: RefreshCw,
      clase: "sync-indicador-azul sync-indicador-girando",
      texto: t("sync.sincronizando"),
    },
    conectado: {
      Icono: Wifi,
      clase: "sync-indicador-verde",
      texto: t("sync.conectado"),
    },
    todo_sincronizado: {
      Icono: CheckCircle2,
      clase: "sync-indicador-verde",
      texto: t("sync.todo_sincronizado"),
    },
  }[estado];

  const Icono = config.Icono;

  return (
    <>
      <div className="sync-indicador-grupo">
        <button
          type="button"
          className={`sync-indicador ${config.clase}`}
          onClick={() => sincronizarAhora()}
          title={conError > 0 ? t("sync.hay_errores") : undefined}
        >
          <Icono size={15} />
          <span className="sync-indicador-texto">{config.texto}</span>
          {pendientes > 0 && <span className="sync-indicador-badge">{pendientes}</span>}
        </button>

        {conError > 0 && (
          // Botón propio (no un <span> anidado dentro del botón de
          // arriba, que además de ser HTML inválido no se podía
          // alcanzar con teclado/lector de pantalla) — abre el panel de
          // errores en vez de disparar sincronizarAhora() como el botón
          // de al lado (que de todas formas nunca tocaría estas filas,
          // ya que solo reintenta las que siguen en "pendiente").
          <button
            type="button"
            className="sync-indicador-badge sync-indicador-badge-error"
            onClick={() => setPanelAbierto(true)}
            aria-label={t("sync.ver_errores")}
            title={t("sync.ver_errores")}
          >
            {conError}
          </button>
        )}
      </div>

      <PanelErroresSync abierto={panelAbierto} onCerrar={() => setPanelAbierto(false)} />
    </>
  );
}
