import { Tema } from "../components/ThemeProvider";

// Paleta de colores para gráficas multi-color (ej. gráfica de pastel),
// una distinta y armónica por cada tema.
export const PALETAS_GRAFICA: Record<Tema, string[]> = {
  dark: ["#5945e4", "#8b5cf6", "#a78bfa", "#10b981", "#059669", "#3b82f6"],
  green: ["#10b981", "#34d399", "#6ee7b7", "#059669", "#0d9488", "#22d3ee"],
  blue: ["#3b82f6", "#60a5fa", "#93c5fd", "#6366f1", "#0ea5e9", "#818cf8"],
  purple: ["#a855f7", "#c084fc", "#e9d5ff", "#d946ef", "#818cf8", "#f0abfc"],
  amber: ["#f59e0b", "#fbbf24", "#fde68a", "#f97316", "#ea580c", "#facc15"],
  slate: ["#64748b", "#94a3b8", "#cbd5e1", "#475569", "#38bdf8", "#818cf8"],
  cyan: ["#06b6d4", "#22d3ee", "#67e8f9", "#0891b2", "#0e7490", "#5eead4"],
  wine: ["#e11d48", "#fb7185", "#f43f5e", "#be123c", "#9f1239", "#f472b6"],
  light: ["#5945e4", "#7c6cff", "#a78bfa", "#10b981", "#3b82f6", "#f59e0b"],
  pink: ["#d6336c", "#f06595", "#e64980", "#ae3ec9", "#f76707", "#c2255c"],
  mint: ["#10b981", "#34d399", "#059669", "#0d9488", "#22d3ee", "#65a30d"],
  sunset: ["#f97316", "#fb923c", "#fdba74", "#ea580c", "#c2410c", "#facc15"],
};

export function obtenerPaletaGrafica(tema: Tema): string[] {
  return PALETAS_GRAFICA[tema] ?? PALETAS_GRAFICA.dark;
}
