"use client";

interface Props {
  totalVentas: number;
  ingresos: number;
  productosVendidos: number;
  promedio: number;
}

export default function Resumen({
  totalVentas,
  ingresos,
  productosVendidos,
  promedio,
}: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit,minmax(220px,1fr))",
        gap: 20,
        marginTop: 24,
      }}
    >
      <div className="card">
        <h3
          style={{
            color: "#9ca3af",
            marginBottom: 10,
          }}
        >
          💰 Total de ventas
        </h3>

        <h2
          style={{
            fontSize: 30,
            color: "#7c3aed",
          }}
        >
          {totalVentas}
        </h2>
      </div>

      <div className="card">
        <h3
          style={{
            color: "#9ca3af",
            marginBottom: 10,
          }}
        >
          💵 Ingresos
        </h3>

        <h2
          style={{
            fontSize: 30,
            color: "#10b981",
          }}
        >
          ${ingresos.toFixed(2)}
        </h2>
      </div>

      <div className="card">
        <h3
          style={{
            color: "#9ca3af",
            marginBottom: 10,
          }}
        >
          📦 Productos vendidos
        </h3>

        <h2
          style={{
            fontSize: 30,
            color: "#3b82f6",
          }}
        >
          {productosVendidos}
        </h2>
      </div>

      <div className="card">
        <h3
          style={{
            color: "#9ca3af",
            marginBottom: 10,
          }}
        >
          📈 Venta promedio
        </h3>

        <h2
          style={{
            fontSize: 30,
            color: "#f59e0b",
          }}
        >
          ${promedio.toFixed(2)}
        </h2>
      </div>
    </div>
  );
}