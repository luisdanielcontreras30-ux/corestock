"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { Venta } from "./types";
import {
  formatoFecha,
  formatoMoneda,
} from "./utils";
import FacturaModal from "./components/FacturaModal";
import { useIdioma } from "../../components/LanguageProvider";

interface Props {
  ventas: Venta[];
  eliminarVenta: (id: number) => void;
  exportarExcel: () => void;
}

export default function Historial({
  ventas,
  eliminarVenta,
  exportarExcel,
}: Props) {
  const { t } = useIdioma();
  const [ventaFactura, setVentaFactura] = useState<Venta | null>(null);

  return (
    <div className="card fade-up">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            {t("ventas.historial_titulo")}
          </h2>

          <p
            style={{
              color: "var(--text-secondary)",
            }}
          >
            {t("ventas.historial_subtitulo")}
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={exportarExcel}
        >
          {t("ventas.exportar_excel")}
        </button>
      </div>

      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>{t("tabla.fecha")}</th>
              <th>{t("ventas.cliente")}</th>
              <th>{t("tabla.producto")}</th>
              <th>{t("tabla.cantidad")}</th>
              <th>{t("productos.precio")}</th>
              <th>{t("tabla.total")}</th>
              <th>{t("usuarios.col_acciones")}</th>
            </tr>
          </thead>

          <tbody>
            {ventas.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    textAlign: "center",
                    padding: 30,
                  }}
                >
                  {t("ventas.sin_ventas")}
                </td>
              </tr>
            ) : (
              ventas.map((venta) => (
                <tr key={venta.id}>
                  <td>
                    {formatoFecha(
                      venta.fecha
                    )}
                  </td>

                  <td>
                    {venta.clientes?.nombre ??
                      t("ventas.cliente_general")}
                  </td>

                  <td>{venta.producto}</td>

                  <td>{venta.cantidad}</td>

                  <td>
                    {formatoMoneda(
                      venta.precio
                    )}
                  </td>

                  <td
                    style={{
                      fontWeight: 700,
                      color: "var(--primary)",
                    }}
                  >
                    {formatoMoneda(
                      venta.total
                    )}
                  </td>

                  <td>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                      }}
                    >
                      <button
                        className="btn-edit"
                        style={{ display: "flex", alignItems: "center", gap: 5 }}
                        onClick={() =>
                          setVentaFactura(venta)
                        }
                      >
                        <Receipt size={13} /> {t("ventas.factura")}
                      </button>

                      <button
                        className="btn-delete"
                        onClick={() =>
                          eliminarVenta(
                            venta.id
                          )
                        }
                      >
                        {t("ventas.eliminar")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {ventaFactura && (
        <FacturaModal
          venta={ventaFactura}
          onClose={() => setVentaFactura(null)}
        />
      )}
    </div>
  );
}
