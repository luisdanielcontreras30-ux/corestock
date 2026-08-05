"use client";

import { useEffect, useState } from "react";
import { useTheme } from "./ThemeProvider";

const CANTIDAD_COLUMNAS = 16;
const CARACTERES_POR_COLUMNA = 40;

function generarColumna(): string {
  let texto = "";
  for (let i = 0; i < CARACTERES_POR_COLUMNA; i++) {
    texto += Math.random() < 0.5 ? "0" : "1";
    texto += "\n";
  }
  // Duplicada para que la animación (translateY 0% -> -50%) haga un
  // lazo perfecto sin que se note la costura.
  return texto + texto;
}

interface Columna {
  texto: string;
  izquierda: number;
  duracionS: number;
  retrasoS: number;
}

// Lluvia de números binarios de fondo para el tema Matrix — decorativa
// y detrás de todo (pointer-events: none, z-index bajo), con opacidad
// baja a propósito para que se sienta el ambiente sin restarle
// legibilidad al texto de encima. Solo existe mientras el tema activo
// es "matrix" — en el resto de los temas (incluido "neongreen", que
// comparte la misma paleta pero sin esta decoración) no renderiza nada.
export default function FondoMatrix() {
  const { tema } = useTheme();
  const [columnas, setColumnas] = useState<Columna[] | null>(null);

  useEffect(() => {
    if (tema !== "matrix") {
      setColumnas(null);
      return;
    }

    const prefiereMenosMovimiento =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefiereMenosMovimiento) {
      setColumnas(null);
      return;
    }

    setColumnas(
      Array.from({ length: CANTIDAD_COLUMNAS }, () => ({
        texto: generarColumna(),
        izquierda: Math.random() * 100,
        duracionS: 9 + Math.random() * 10,
        retrasoS: -Math.random() * 15,
      }))
    );
  }, [tema]);

  if (tema !== "matrix" || !columnas) return null;

  return (
    <div className="fondo-matrix" aria-hidden="true">
      {columnas.map((col, i) => (
        <span
          key={i}
          className="fondo-matrix-columna"
          style={{
            left: `${col.izquierda}%`,
            animationDuration: `${col.duracionS}s`,
            animationDelay: `${col.retrasoS}s`,
          }}
        >
          {col.texto}
        </span>
      ))}
    </div>
  );
}
