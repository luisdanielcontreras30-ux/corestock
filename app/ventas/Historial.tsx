"use client";

import { Venta } from "./types";
import {
  formatoFecha,
  formatoMoneda,
} from "./utils";

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
            Historial de Ventas
          </h2>

          <p
            style={{
              color: "var(--text-secondary)",
            }}
          >
            Ventas registradas.
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={exportarExcel}
        >
          Exportar Excel
        </button>
      </div>

      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th>Total</th>
              <th>Acciones</th>
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
                  No hay ventas registradas.
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
                      "Cliente General"}
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
                      color: "#7c6cff",
                    }}
                  >
                    {formatoMoneda(
                      venta.total
                    )}
                  </td>

                  <td>
                    <button
                      className="btn-delete"
                      onClick={() =>
                        eliminarVenta(
                          venta.id
                        )
                      }
                    >
                      Eliminar
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