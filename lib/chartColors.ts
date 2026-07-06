import { Tema } from "../components/ThemeProvider";

// Paleta de colores para gráficas multi-color (ej. gráfica de pastel),
// una distinta y armónica por cada tema.
export const PALETAS_GRAFICA: Record<Tema, string[]> = {
  dark: ["#5945e4", "#8b5cf6", "#a78bfa", "#10b981", "#059669", "#3b82f6"],
  green: ["#10b981", "#34d399", "#6ee7b7", "#059669", "#0d9488", "#22d3ee"],
  blue: ["#3b82f6", "#60a5fa", "#93c5fd", "#6366f1", "#0ea5e9", "#818cf8"],
  light: ["#5945e4", "#7c6cff", "#a78bfa", "#10b981", "#3b82f6", "#f59e0b"],
  pink: ["#ec4899", "#f472b6", "#fb7185", "#d946ef", "#f9a8d4", "#e879f9"],
};

export function obtenerPaletaGrafica(tema: Tema): string[] {
  return PALETAS_GRAFICA[tema] ?? PALETAS_GRAFICA.dark;
}
