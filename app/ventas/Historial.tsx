"use client";

import { useState } from "react";
import { Venta } from "./types";
import {
  formatoFecha,
  formatoMoneda,
  CLAVE_METODO_PAGO,
} from "./utils";
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
  const [busqueda, setBusqueda] = useState("");

  const ventasFiltradas = ventas.filter((venta) => {
    const termino = busqueda.toLowerCase().trim();
    if (!termino) return true;

    const nombreCliente = (venta.clientes?.nombre ?? t("ventas.cliente_general")).toLowerCase();
    return (
      nombreCliente.includes(termino) ||
      venta.producto.toLowerCase().includes(termino)
    );
  });

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

      <input
        style={{ marginBottom: 16 }}
        placeholder={t("ventas.buscar_historial")}
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

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
              <th>{t("ventas.metodo_pago")}</th>
              <th>{t("usuarios.col_acciones")}</th>
            </tr>
          </thead>

          <tbody>
            {ventasFiltradas.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    textAlign: "center",
                    padding: 30,
                  }}
                >
                  {ventas.length === 0 ? t("ventas.sin_ventas") : t("ventas.sin_resultados_busqueda")}
                </td>
              </tr>
            ) : (
              ventasFiltradas.map((venta) => (
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

                  <td>{t(CLAVE_METODO_PAGO[venta.metodo_pago] ?? CLAVE_METODO_PAGO.efectivo)}</td>

                  <td>
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
