"use client";

// Fila de encabezado de sección dentro de una tabla — usada para
// separar Ventas/Facturas por fecha (Hoy, Ayer, Últimos 7 días...) y
// Productos por categoría, en vez de una sola lista continua.
interface Props {
  etiqueta: string;
  colSpan: number;
}

export default function FilaGrupo({ etiqueta, colSpan }: Props) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        style={{
          background: "var(--table-header-bg)",
          color: "var(--text-secondary)",
          fontWeight: 700,
          fontSize: 12.5,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          padding: "9px 16px",
        }}
      >
        {etiqueta}
      </td>
    </tr>
  );
}
