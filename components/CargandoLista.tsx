"use client";

import type { CSSProperties } from "react";

// Reemplazo genérico para el antiguo `<div className="card">Cargando...</div>`
// que se repetía en casi todas las páginas de listado/tabla — ahora
// muestra una silueta animada del contenido real (mismo patrón que ya
// se usa en Dashboard, Ventas y Productos) en vez de un texto plano.
interface Props {
  filas?: number;
  style?: CSSProperties;
}

export default function CargandoLista({ filas = 5, style }: Props) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, ...style }}>
      {Array.from({ length: filas }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 52, borderRadius: 10, animationDelay: `${i * 0.06}s` }}
        />
      ))}
    </div>
  );
}
