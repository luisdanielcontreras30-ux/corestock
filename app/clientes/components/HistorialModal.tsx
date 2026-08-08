"use client";

import { X } from "lucide-react";
import { ClienteConResumen, CompraCliente } from "../types";
import { formatoFecha, formatoMoneda } from "../../ventas/utils";
import { useIdioma } from "../../../components/LanguageProvider";

interface Props {
  cliente: ClienteConResumen;
  compras: CompraCliente[];
  cargando: boolean;
  onClose: () => void;
}

export default function HistorialModal({
  cliente,
  compras,
  cargando,
  onClose,
}: Props) {
  const { t } = useIdioma();

  return (
    <div className="factura-overlay" onClick={onClose}>
      <div
        className="factura-modal"
        style={{ maxWidth: 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="factura-modal-toolbar">
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>
              {t("clientes.historial_titulo")} — {cliente.nombre}
            </h2>

            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              {t("clientes.compras_totales")}: {cliente.compras} ·{" "}
              {t("clientes.total_gastado")}:{" "}
              {formatoMoneda(cliente.totalGastado)}
            </p>
          </div>

          <button className="btn-secondary" onClick={onClose} aria-label={t("factura.cerrar")}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {cargando ? (
            <p style={{ textAlign: "center", padding: 20 }}>
              {t("header.cargando")}
            </p>
          ) : (
            <div className="tabla">
              <table>
                <thead>
                  <tr>
                    <th>{t("tabla.fecha")}</th>
                    <th>{t("tabla.producto")}</th>
                    <th>{t("tabla.cantidad")}</th>
                    <th>{t("productos.precio")}</th>
                    <th>{t("tabla.total")}</th>
                  </tr>
                </thead>

                <tbody>
                  {compras.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: 30 }}>
                        {t("clientes.historial_sin_compras")}
                      </td>
                    </tr>
                  ) : (
                    compras.map((compra) => (
                      <tr key={compra.id}>
                        <td>{formatoFecha(compra.fecha)}</td>
                        <td>{compra.producto}</td>
                        <td>{compra.cantidad}</td>
                        <td>{formatoMoneda(compra.precio)}</td>

                        <td style={{ fontWeight: 700, color: "var(--primary)" }}>
                          {formatoMoneda(compra.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
