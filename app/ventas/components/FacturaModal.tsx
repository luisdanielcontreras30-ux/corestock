"use client";

import { Venta } from "../types";
import { formatoFecha, formatoMoneda } from "../utils";

interface Props {
  venta: Venta;
  onClose: () => void;
}

export default function FacturaModal({ venta, onClose }: Props) {
  const folio = `F-${String(venta.id).padStart(6, "0")}`;

  return (
    <div className="factura-overlay" onClick={onClose}>
      <div
        className="factura-modal fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="factura-modal-toolbar">
          <button className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>

          <button
            className="btn-primary"
            onClick={() => window.print()}
          >
            🖨️ Imprimir / Guardar PDF
          </button>
        </div>

        <div className="factura-hoja">
          <div className="factura-header">
            <div>
              <h1>CoreStock</h1>
              <p>Sistema Inteligente de Inventario</p>
            </div>

            <div className="factura-folio">
              <p className="factura-folio-label">FACTURA</p>
              <p className="factura-folio-numero">{folio}</p>
              <p className="factura-folio-fecha">
                {formatoFecha(venta.fecha)}
              </p>
            </div>
          </div>

          <div className="factura-cliente">
            <p className="factura-cliente-label">Facturado a</p>
            <p className="factura-cliente-nombre">
              {venta.clientes?.nombre ?? "Cliente General"}
            </p>
          </div>

          <table className="factura-tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio unitario</th>
                <th>Total</th>
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
              <span>Total</span>
              <span>{formatoMoneda(venta.total)}</span>
            </div>
          </div>

          <p className="factura-footer">
            Gracias por su compra — generado con CoreStock
          </p>
        </div>
      </div>
    </div>
  );
}
