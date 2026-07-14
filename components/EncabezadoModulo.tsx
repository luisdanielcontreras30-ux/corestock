import { LucideIcon } from "lucide-react";

interface Props {
  Icono: LucideIcon;
  color: string;
  titulo: string;
  subtitulo: string;
}

// Encabezado compartido por los módulos del sistema — cada uno con su
// propio color de acento (el mismo que usa en la navegación móvil),
// para que cada apartado se distinga a simple vista en vez de que
// todos se vean iguales.
export default function EncabezadoModulo({ Icono, color, titulo, subtitulo }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <span
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: `${color}1f`,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icono size={26} color={color} />
      </span>
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>{titulo}</h1>
        <p style={{ color: "var(--text-secondary)", margin: "2px 0 0 0" }}>{subtitulo}</p>
      </div>
    </div>
  );
}
