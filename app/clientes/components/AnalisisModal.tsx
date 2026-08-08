"use client";

import { useEffect, useState } from "react";
import { X, MessageCircle, Wallet, Receipt, Clock, TrendingUp } from "lucide-react";
import { ClienteConResumen } from "../types";
import { analizarClienteConIA, ResultadoAnalisisEntidad } from "../../../lib/iaAcciones";
import { mensajeErrorSeguro } from "../../../lib/errores";
import { enlaceWhatsApp } from "../../../lib/whatsapp";
import { formatoMoneda } from "../../ventas/utils";
import { useIdioma } from "../../../components/LanguageProvider";

interface Props {
  cliente: ClienteConResumen;
  onClose: () => void;
}

export default function AnalisisModal({ cliente, onClose }: Props) {
  const { t, idioma } = useIdioma();

  const [cargando, setCargando] = useState(true);
  const [resultado, setResultado] = useState<ResultadoAnalisisEntidad | null>(null);
  const [error, setError] = useState("");
  const [mensajeEditado, setMensajeEditado] = useState("");

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const datos = await analizarClienteConIA(cliente.id, idioma);
        if (cancelado) return;
        setResultado(datos);
        setMensajeEditado(datos.mensaje ?? "");
      } catch (err) {
        if (cancelado) return;
        console.error(err);
        setError(mensajeErrorSeguro(err) || t("analisis_ia.msg_error"));
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
    // Un solo análisis por apertura del modal — no debe repetirse si
    // cambia el idioma mientras está abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.id]);

  function abrirWhatsApp() {
    window.open(enlaceWhatsApp(mensajeEditado, cliente.telefono), "_blank");
  }

  return (
    <div className="factura-overlay" onClick={onClose}>
      <div className="factura-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="factura-modal-toolbar">
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>
            {t("analisis_ia.titulo_modal")} — {cliente.nombre}
          </h2>
          <button className="btn-secondary" onClick={onClose} aria-label={t("factura.cerrar")}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {cargando ? (
            <p style={{ textAlign: "center", padding: 20 }}>{t("analisis_ia.analizando")}</p>
          ) : error ? (
            <p style={{ textAlign: "center", padding: 20, color: "#ef4444" }}>{error}</p>
          ) : !resultado || resultado.compras === 0 ? (
            <p style={{ textAlign: "center", padding: 20, color: "var(--text-secondary)" }}>
              {t("analisis_ia.sin_historial")}
            </p>
          ) : (
            <>
              <p className="analisis-ia-producto">
                {resultado.productoTop
                  ? t("analisis_ia.producto_principal").replace("{producto}", resultado.productoTop)
                  : t("analisis_ia.producto_principal").replace(
                      "{producto}",
                      t("analisis_ia.sin_producto_principal")
                    )}
              </p>

              <div className="analisis-ia-metricas">
                <div>
                  <Wallet size={14} />
                  <span className="analisis-ia-metrica-valor">{formatoMoneda(resultado.totalGastado)}</span>
                  <span className="analisis-ia-metrica-etiqueta">{t("analisis_ia.gastado_total")}</span>
                </div>
                <div>
                  <Receipt size={14} />
                  <span className="analisis-ia-metrica-valor">{resultado.compras}</span>
                  <span className="analisis-ia-metrica-etiqueta">{t("analisis_ia.compras_totales")}</span>
                </div>
                <div>
                  <Clock size={14} />
                  <span className="analisis-ia-metrica-valor">
                    {resultado.frecuenciaDias !== null
                      ? t("analisis_ia.cada_x_dias").replace("{dias}", String(resultado.frecuenciaDias))
                      : "—"}
                  </span>
                  <span className="analisis-ia-metrica-etiqueta">{t("analisis_ia.frecuencia")}</span>
                </div>
                <div>
                  <TrendingUp size={14} />
                  <span className="analisis-ia-metrica-valor">
                    {resultado.prediccionMensual !== null ? formatoMoneda(resultado.prediccionMensual) : "—"}
                  </span>
                  <span className="analisis-ia-metrica-etiqueta">{t("analisis_ia.prediccion_mes")}</span>
                </div>
              </div>

              {resultado.prediccionMensual !== null && (
                <p className="analisis-ia-disclaimer">{t("analisis_ia.disclaimer_prediccion")}</p>
              )}

              <div style={{ marginTop: 16 }}>
                <textarea
                  value={mensajeEditado}
                  onChange={(e) => setMensajeEditado(e.target.value)}
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              </div>

              {cliente.telefono ? (
                <button
                  className="btn-secondary"
                  onClick={abrirWhatsApp}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center", width: "100%", marginTop: 12 }}
                >
                  <MessageCircle size={15} /> {t("analisis_ia.abrir_whatsapp")}
                </button>
              ) : (
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 12 }}>
                  {t("analisis_ia.sin_telefono")}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
