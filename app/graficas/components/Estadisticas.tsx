"use client";

interface Props {
  ventas: number;
  ingresos: number;
  productos: number;
  promedio: number;
}

export default function Estadisticas({
  ventas,
  ingresos,
  productos,
  promedio,
}: Props) {
  const cards = [
    {
      titulo: "Ventas",
      valor: ventas,
      color: "#7c3aed",
    },
    {
      titulo: "Ingresos",
      valor: `$${ingresos.toFixed(2)}`,
      color: "#10b981",
    },
    {
      titulo: "Productos vendidos",
      valor: productos,
      color: "#3b82f6",
    },
    {
      titulo: "Venta promedio",
      valor: `$${promedio.toFixed(2)}`,
      color: "#f59e0b",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit,minmax(230px,1fr))",
        gap: 20,
      }}
    >
      {cards.map((card) => (
        <div
          key={card.titulo}
          className="card"
          style={{
            padding: 24,
            borderRadius: 18,
            background:
              "linear-gradient(145deg,#1a1f38,#111827)",
            border: `1px solid ${card.color}40`,
            boxShadow:
              "0 10px 30px rgba(0,0,0,.25)",
          }}
        >
          <p
            style={{
              color: "#9ca3af",
              marginBottom: 10,
              fontSize: 15,
            }}
          >
            {card.titulo}
          </p>

          <h2
            style={{
              color: card.color,
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            {card.valor}
          </h2>
        </div>
      ))}
    </div>
  );
}