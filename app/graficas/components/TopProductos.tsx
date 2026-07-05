"use client";

import { ProductoGrafica } from "../types";

interface Props {
  productos: ProductoGrafica[];
}

export default function TopProductos({
  productos,
}: Props) {
  return (
    <div className="card">

      <h2
        style={{
          marginBottom: 20,
          fontSize: 24,
          fontWeight: 700,
        }}
      >
        🏆 Top Productos
      </h2>

      {productos.length === 0 ? (
        <p>No hay datos.</p>
      ) : (
        productos.map((producto, index) => (
          <div
            key={producto.id}
            style={{
              marginBottom: 18,
              paddingBottom: 18,
              borderBottom:
                "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                marginBottom: 8,
              }}
            >
              <strong>
                #{index + 1} {producto.nombre}
              </strong>

              <span>
                ${producto.ventas.toFixed(2)}
              </span>
            </div>

            <div
              style={{
                width: "100%",
                height: 10,
                background: "#222",
                borderRadius: 20,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(
                    producto.ventas / 100,
                    100
                  )}%`,
                  height: "100%",
                  background:
                    "#7c3aed",
                }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}