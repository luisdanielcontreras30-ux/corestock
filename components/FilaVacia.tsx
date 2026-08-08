"use client";

import { Inbox } from "lucide-react";

// Fila de "sin resultados" reutilizable para tablas — antes cada
// página repetía un <td> con solo texto plano centrado; esta versión
// agrega el mismo tratamiento con ícono que ya usaba Alertas.
interface Props {
  mensaje: string;
  colSpan: number;
}

export default function FilaVacia({ mensaje, colSpan }: Props) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ textAlign: "center", padding: "40px 20px" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            color: "var(--text-secondary)",
          }}
        >
          <Inbox size={26} color="var(--text-muted)" />
          <span>{mensaje}</span>
        </div>
      </td>
    </tr>
  );
}
