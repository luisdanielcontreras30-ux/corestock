"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface Props {
  nombre: string;
  ventas: number;
  unidades: number;
  data: {
    nombre: string;
    ventas: number;
  }[];
}

export default function ProductoCard({
  nombre,
  ventas,
  unidades,
  data,
}: Props) {
  return (
    <div
      className="card"
      style={{
        padding: 20,
        borderRadius: 18,
      }}
    >
      <h3
        style={{
          marginBottom: 8,
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        {nombre}
      </h3>

      <p
        style={{
          color: "#9ca3af",
          marginBottom: 4,
        }}
      >
        Ventas
      </p>

      <h2
        style={{
          color: "#7c3aed",
          fontSize: 28,
        }}
      >
        ${ventas.toFixed(2)}
      </h2>

      <p
        style={{
          marginBottom: 18,
          color: "#9ca3af",
        }}
      >
        {unidades} unidades
      </p>

      <ResponsiveContainer
        width="100%"
        height={120}
      >
        <AreaChart data={data}>
          <Area
            type="monotone"
            dataKey="ventas"
            stroke="#7c3aed"
            fill="#7c3aed33"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
