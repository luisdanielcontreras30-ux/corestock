"use client";

import { Printer, MessageCircle } from "lucide-react";
import { Venta } from "../types";
import { formatoFecha, formatoMoneda } from "../utils";
import { useIdioma } from "../../../components/LanguageProvider";

interface Props {
  venta: Venta;
  onClose: () => void;
}

export default function FacturaModal({ venta, onClose }: Props) {
  const { t } = useIdioma();
  const folio = `F-${String(venta.id).padStart(6, "0")}`;

  function compartirPorWhatsApp() {
    const cliente = venta.clientes?.nombre ?? t("ventas.cliente_general");

    const mensaje =
      `🧾 *CoreStock — ${t("factura.numero")} ${folio}*\n\n` +
      `${t("factura.facturado_a")}: ${cliente}\n` +
      `${formatoFecha(venta.fecha)}\n\n` +
      `${venta.producto} x${venta.cantidad}\n` +
      `${t("tabla.total")}: ${formatoMoneda(venta.total)}\n\n` +
      `${t("factura.gracias")}`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");
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

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-whatsapp"
              onClick={compartirPorWhatsApp}
            >
              <MessageCircle size={15} /> {t("factura.whatsapp")}
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
              <p>{t("factura.subtitulo")}</p>
            </div>

            <div className="factura-folio">
              <p className="factura-folio-label">{t("factura.numero")}</p>
              <p className="factura-folio-numero">{folio}</p>
              <p className="factura-folio-fecha">
                {formatoFecha(venta.fecha)}
              </p>
            </div>
          </div>

          <div className="factura-cliente">
            <p className="factura-cliente-label">{t("factura.facturado_a")}</p>
            <p className="factura-cliente-nombre">
              {venta.clientes?.nombre ?? t("ventas.cliente_general")}
            </p>
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
                <td>{venta.producto}</td>
                <td>{venta.cantidad}</td>
                <td>{formatoMoneda(venta.precio)}</td>
                <td>{formatoMoneda(venta.total)}</td>
              </tr>
            </tbody>
          </table>

          <div className="factura-totales">
            <div className="factura-total-fila factura-total-final">
              <span>{t("tabla.total")}</span>
              <span>{formatoMoneda(venta.total)}</span>
            </div>
          </div>

          <p className="factura-footer">
            {t("factura.gracias")}
          </p>
        </div>
      </div>
    </div>
  );
}
