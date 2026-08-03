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
  teal: ["#0d9488", "#2dd4bf", "#5eead4", "#0f766e", "#0e7490", "#84cc16"],
  matrix: ["#39ff14", "#7cff5a", "#adff9e", "#00ff41", "#2ecc0f", "#c8ffb8"],
  neonpink: ["#ff2df7", "#ff70fa", "#ffb3fa", "#e619dd", "#d61fd1", "#ffd9fc"],
  neonblue: ["#00baff", "#4fd0ff", "#99e3ff", "#00a0e6", "#0090c2", "#cceffc"],
  neonpurple: ["#b026ff", "#c661ff", "#d9a6ff", "#9a1fe6", "#8f1ecc", "#ecd1ff"],
  neonorange: ["#ff6a00", "#ff9142", "#ffbb80", "#e65f00", "#cc5500", "#ffdcc2"],
  rose: ["#e0729a", "#ea94b3", "#f2b6cc", "#c65a80", "#a84768", "#f7d6e3"],
  ocean: ["#0ea5e9", "#38bdf8", "#7dd3fc", "#0c8bc4", "#0a6f9e", "#bae6fd"],
  coral: ["#ff6f61", "#ff8f84", "#ffb0a8", "#e2564a", "#c44238", "#ffd4cf"],
  lavender: ["#9b8afb", "#b3a5fc", "#cbc0fd", "#7f6cf0", "#6653d6", "#e3ddfe"],
  midnight: ["#818cf8", "#a3abfa", "#c5cafc", "#6a74e0", "#525dc7", "#e7e9fd"],
  peach: ["#fb923c", "#fca85f", "#fdc088", "#e17a26", "#c46414", "#fee0c2"],
  steel: ["#38bdf8", "#67cbfa", "#96d9fb", "#24a3dd", "#1a89bd", "#c5eafc"],
  ruby: ["#dc2626", "#e5504f", "#ee7a79", "#b81f1f", "#941919", "#f7bcbc"],
  gold: ["#eab308", "#f0c33e", "#f5d76e", "#c99807", "#a67d06", "#faeaad"],
  ice: ["#0ea5e9", "#4fc3fb", "#8fddfc", "#0c8bc4", "#0a6f9e", "#c9f0fe"],
  cyberpunk: ["#fcee0a", "#00f0ff", "#ff2df7", "#d9cd09", "#00c9d1", "#e619dd"],
  tron: ["#00f6ff", "#4ff9ff", "#9efcff", "#00c9d1", "#00a2a8", "#c9feff"],
  joker: ["#7cff2e", "#a3ff6e", "#c9ffa6", "#64d922", "#4fb019", "#e0ffcc"],
  terminator: ["#ff0a0a", "#9a9aa4", "#ff4f4f", "#c8c8d0", "#d90808", "#e5e5ea"],
  strangerthings: ["#e10600", "#3c78ff", "#f24940", "#8fb3ff", "#b80500", "#14275a"],
};

export function obtenerPaletaGrafica(tema: Tema): string[] {
  return PALETAS_GRAFICA[tema] ?? PALETAS_GRAFICA.dark;
}
