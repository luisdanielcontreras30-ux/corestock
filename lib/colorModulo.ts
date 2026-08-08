"use client";

import { useTheme, Tema } from "../components/ThemeProvider";

// Identidad de color por módulo.
//
// La regla: en los temas NEUTROS (claro y oscuro) cada módulo lleva el
// color de su propio icono — el mismo que ya usa en la navegación móvil
// — para que Compras, Ventas y Fabricación se distingan a simple vista
// en vez de verse los 27 iguales.
//
// En los otros once temas manda el tema. Alguien que eligió "Vino" o
// "Menta" lo eligió a propósito, y meterle un naranja fijo encima
// rompería justo lo que fue a buscar. Ese era el problema concreto de
// Fabricación: su naranja no se apagaba nunca, con ningún tema.
const TEMAS_NEUTROS: Tema[] = ["dark", "light"];

export function useColorModulo(colorPropio: string): string {
  const { tema } = useTheme();
  return TEMAS_NEUTROS.includes(tema) ? colorPropio : "var(--primary)";
}

// Fondo tenue del mismo color, para las cajas de icono y las insignias.
//
// Con un hex se le pega el sufijo de transparencia, que funciona en
// cualquier navegador. Solo cuando el color viene de una variable del
// tema hace falta color-mix: no se puede concatenar nada a un var(),
// y hacerlo producía CSS inválido que el navegador descarta sin avisar.
export function fondoTenue(color: string, porcentaje = 12): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    // 12% ≈ 0x1f sobre 255; se conserva el valor exacto que ya se venía
    // usando para no cambiar el aspecto en claro y oscuro.
    return `${color}${Math.round((porcentaje / 100) * 255).toString(16).padStart(2, "0")}`;
  }
  return `color-mix(in srgb, ${color} ${porcentaje}%, transparent)`;
}
