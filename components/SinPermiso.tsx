"use client";

import { ShieldOff } from "lucide-react";
import { useIdioma } from "./LanguageProvider";

// Aviso reutilizable para cuando un miembro del equipo entra a una
// sección para la que no tiene permiso (ver MiembroActivoProvider).
export default function SinPermiso() {
  const { t } = useIdioma();

  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 10,
        padding: 32,
      }}
    >
      <ShieldOff size={28} color="var(--text-muted)" />
      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13.5 }}>
        {t("permisos.sin_acceso")}
      </p>
    </div>
  );
}
