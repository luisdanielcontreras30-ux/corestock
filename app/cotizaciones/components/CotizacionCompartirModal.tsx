"use client";

import { Printer, MessageCircle, Mail, Camera } from "lucide-react";
import { Cotizacion } from "../types";
import { useIdioma } from "../../../components/LanguageProvider";
import { useToast } from "../../../components/ToastProvider";

interface Props {
  cotizacion: Cotizacion;
  onClose: () => void;
}

export default function CotizacionCompartirModal({ cotizacion, onClose }: Props) {
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const folio = `COT-${String(cotizacion.id).padStart(6, "0")}`;
  const nombreCliente = cotizacion.cliente_nombre || t("ventas.cliente_general");
  const fecha = new Date(cotizacion.fecha).toLocaleDateString();

  const mensaje =
    `🧾 *CoreStock — ${t("cotizaciones.hoja_subtitulo")} ${folio}*\n\n` +
    `${t("factura.facturado_a")}: ${nombreCliente}\n` +
    `${fecha}\n\n` +
    `${cotizacion.producto} x${cotizacion.cantidad}\n` +
    `${t("tabla.total")}: $${Number(cotizacion.total).toFixed(2)}\n\n` +
    (cotizacion.nota ? `${cotizacion.nota}\n\n` : "") +
    `${t("factura.gracias")}`;

  function compartirPorWhatsApp() {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");
  }

  function compartirPorCorreo() {
    const asunto = `${t("cotizaciones.hoja_subtitulo")} ${folio}`;
    const url = `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`;
    window.location.href = url;
  }

  async function compartirPorInstagram() {
    // Instagram no tiene una URL pública para prellenar un mensaje directo,
    // así que usamos el panel nativo para compartir del sistema (que incluye
    // Instagram entre las apps disponibles) cuando el navegador lo soporta.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `CoreStock — ${folio}`, text: mensaje });
      } catch {
        // El usuario cerró el panel de compartir — no hacemos nada más.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(mensaje);
      mostrarToast(t("cotizaciones.msg_copiado_instagram"), "exito");
    } catch {
      mostrarToast(t("cotizaciones.msg_copiar_manual"), "error");
    }
    window.open("https://www.instagram.com/direct/inbox/", "_blank");
  }

  return (
    <div className="factura-overlay" onClick={onClose}>
      <div
        className="factura-modal fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="factura-modal-toolbar">
          <button className="btn-secondary" onClick={onClose}>
            {t("factura.cerrar")}
          </button>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn-whatsapp" onClick={compartirPorWhatsApp}>
              <MessageCircle size={15} /> {t("factura.whatsapp")}
            </button>

            <button className="btn-instagram" onClick={compartirPorInstagram}>
              <Camera size={15} /> {t("cotizaciones.instagram")}
            </button>

            <button className="btn-correo" onClick={compartirPorCorreo}>
              <Mail size={15} /> {t("cotizaciones.correo")}
            </button>

            <button
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => window.print()}
            >
              <Printer size={15} /> {t("factura.imprimir")}
            </button>
          </div>
        </div>

        <div className="factura-hoja">
          <div className="factura-header">
            <div>
              <h1>CoreStock</h1>
              <p>{t("cotizaciones.hoja_subtitulo")}</p>
            </div>

            <div className="factura-folio">
              <p className="factura-folio-label">{t("cotizaciones.numero_cotizacion")}</p>
              <p className="factura-folio-numero">{folio}</p>
              <p className="factura-folio-fecha">{fecha}</p>
            </div>
          </div>

          <div className="factura-cliente">
            <p className="factura-cliente-label">{t("factura.facturado_a")}</p>
            <p className="factura-cliente-nombre">{nombreCliente}</p>
          </div>

          <table className="factura-tabla">
            <thead>
              <tr>
                <th>{t("tabla.producto")}</th>
                <th>{t("tabla.cantidad")}</th>
                <th>{t("factura.precio_unitario")}</th>
                <th>{t("tabla.total")}</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>{cotizacion.producto}</td>
                <td>{cotizacion.cantidad}</td>
                <td>${Number(cotizacion.precio_unitario).toFixed(2)}</td>
                <td>${Number(cotizacion.total).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          {cotizacion.nota && (
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
              {cotizacion.nota}
            </p>
          )}

          <div className="factura-totales">
            <div className="factura-total-fila factura-total-final">
              <span>{t("tabla.total")}</span>
              <span>${Number(cotizacion.total).toFixed(2)}</span>
            </div>
          </div>

          <p className="factura-footer">{t("factura.gracias")}</p>
        </div>
      </div>
    </div>
  );
}
