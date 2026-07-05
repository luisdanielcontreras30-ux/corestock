"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  data: {
    nombre: string;
    ventas: number;
  }[];
}

export default function VentasGenerales({
  data,
}: Props) {
  return (
    <div
      className="card"
      style={{
        marginTop: 24,
        padding: 24,
      }}
    >
      <div
        style={{
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          Ventas Generales
        </h2>

        <p
          style={{
            color: "#9ca3af",
          }}
        >
          Comparativa de ventas del período.
        </p>
      </div>

      <ResponsiveContainer
        width="100%"
        height={420}
      >
        <AreaChart data={data}>
          <defs>
            <linearGradient
              id="ventas"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor="#7c3aed"
                stopOpacity={0.8}
              />

              <stop
                offset="95%"
                stopColor="#7c3aed"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#293548"
          />

          <XAxis
            dataKey="nombre"
            stroke="#9ca3af"
          />

          <YAxis
            stroke="#9ca3af"
          />

          <Tooltip />

          <Area
            type="monotone"
            dataKey="ventas"
            stroke="#7c3aed"
            strokeWidth={4}
            fill="url(#ventas)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}