"use client";

import { useState } from "react";
import { Printer, MessageCircle } from "lucide-react";
import { MetodoPago } from "../types";
import { formatoFecha, formatoMoneda, CLAVE_METODO_PAGO } from "../utils";
import { useIdioma } from "../../../components/LanguageProvider";
import { useEmpresa } from "../../../lib/useEmpresa";
import { enlaceWhatsApp } from "../../../lib/whatsapp";

export interface ItemTicket {
  producto: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
}

interface Props {
  folioId: number;
  fecha: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  metodoPago: MetodoPago;
  items: ItemTicket[];
  total: number;
  onClose: () => void;
}

// Ticket automático que aparece después de cada venta (CoreStock
// Plus+) — misma hoja imprimible/compartible que FacturaModal, pero
// con varias líneas (una venta rápida puede cobrar varios productos a
// la vez, cada uno su propia fila) en vez de una sola. Se mantiene
// como componente aparte para no arriesgar el módulo de Facturas ya
// existente, que trabaja con una venta puntual del historial.
export default function TicketModal({
  folioId,
  fecha,
  clienteNombre,
  clienteTelefono,
  metodoPago,
  items,
  total,
  onClose,
}: Props) {
  const { t } = useIdioma();
  const empresa = useEmpresa();
  const [logoRoto, setLogoRoto] = useState(false);
  const nombreNegocio = empresa?.nombre_negocio?.trim() || "CoreStock";
  const folio = `T-${String(folioId).padStart(6, "0")}`;

  function compartirPorWhatsApp() {
    const lineas = items
      .map((item) => `${item.producto} x${item.cantidad} — ${formatoMoneda(item.total)}`)
      .join("\n");

    const mensaje =
      `🧾 *${nombreNegocio} — ${t("ticket.numero")} ${folio}*\n\n` +
      `${t("factura.facturado_a")}: ${clienteNombre}\n` +
      `${formatoFecha(fecha)}\n\n` +
      `${lineas}\n\n` +
      `${t("tabla.total")}: ${formatoMoneda(total)}\n\n` +
      `${t("factura.gracias")}`;

    window.open(enlaceWhatsApp(mensaje, clienteTelefono), "_blank");
  }

  return (
    <div className="factura-overlay" onClick={onClose}>
      <div className="factura-modal fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="factura-modal-toolbar">
          <button className="btn-secondary" onClick={onClose}>
            {t("factura.cerrar")}
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-whatsapp" onClick={compartirPorWhatsApp}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {empresa?.logo_url && !logoRoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={empresa.logo_url}
                  alt={nombreNegocio}
                  onError={() => setLogoRoto(true)}
                  style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
                />
              )}
              <div>
                <h1>{nombreNegocio}</h1>
                <p>{t("factura.subtitulo")}</p>
                {empresa?.rfc && <p>{empresa.rfc}</p>}
                {empresa?.direccion && <p>{empresa.direccion}</p>}
              </div>
            </div>

            <div className="factura-folio">
              <p className="factura-folio-label">{t("ticket.numero")}</p>
              <p className="factura-folio-numero">{folio}</p>
              <p className="factura-folio-fecha">{formatoFecha(fecha)}</p>
            </div>
          </div>

          <div className="factura-cliente">
            <p className="factura-cliente-label">{t("factura.facturado_a")}</p>
            <p className="factura-cliente-nombre">{clienteNombre}</p>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4 }}>
              {t("ventas.metodo_pago")}: {t(CLAVE_METODO_PAGO[metodoPago] ?? CLAVE_METODO_PAGO.efectivo)}
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
              {items.map((item, index) => (
                <tr key={index}>
                  <td>{item.producto}</td>
                  <td>{item.cantidad}</td>
                  <td>{formatoMoneda(item.precioUnitario)}</td>
                  <td>{formatoMoneda(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="factura-totales">
            <div className="factura-total-fila factura-total-final">
              <span>{t("tabla.total")}</span>
              <span>{formatoMoneda(total)}</span>
            </div>
          </div>

          <p className="factura-footer">{t("factura.gracias")}</p>
        </div>
      </div>
    </div>
  );
}
