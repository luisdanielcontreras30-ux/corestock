"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useIdioma } from "../../../components/LanguageProvider";
import { useAuth } from "../../../components/AuthProvider";
import { useMiembroActivo } from "../../../components/MiembroActivoProvider";

export default function CuentaTab() {
  const { t } = useIdioma();
  const { user, cargando } = useAuth();
  const { miembroActivo, limpiarMiembroActivo } = useMiembroActivo();
  const [cerrando, setCerrando] = useState(false);

  const correo = user?.email || "Sin correo";

  const creadoEn = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  async function cerrarSesion() {
    setCerrando(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    } finally {
      limpiarMiembroActivo();
      window.location.href = "/login";
    }
  }

  const inicial = correo ? correo.charAt(0).toUpperCase() : "U";

  if (cargando) {
    return <div className="card">{t("header.cargando")}</div>;
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h2 style={{ marginBottom: 6 }}>{t("cuenta.titulo")}</h2>
      <p
        style={{
          color: "var(--text-secondary)",
          marginBottom: 20,
          fontSize: 13,
        }}
      >
        {t("cuenta.subtitulo")}
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "var(--primary)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 24,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {inicial}
        </div>

        <div style={{ minWidth: 0 }}>
          <p
            style={{
              color: "var(--text-primary)",
              fontWeight: 700,
              fontSize: 16,
              margin: 0,
              wordBreak: "break-all",
            }}
          >
            {correo}
          </p>
          {creadoEn && (
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: 13,
                margin: "4px 0 0 0",
              }}
            >
              {t("cuenta.miembro_desde")} {creadoEn}
            </p>
          )}
        </div>
      </div>

      {miembroActivo && (
        <div
          className="card"
          style={{
            borderColor: "var(--primary)",
            background: "var(--primary-soft)",
            marginBottom: 20,
            padding: 14,
          }}
        >
          <p style={{ margin: 0, fontSize: 13 }}>
            {t("cuenta.entraste_como")} <strong>{miembroActivo.nombre}</strong>.{" "}
            {t("cuenta.entraste_como_desc")}
          </p>
        </div>
      )}

      <button
        className="logout-real-btn"
        disabled={cerrando}
        onClick={cerrarSesion}
      >
        <LogOut size={15} />
        {cerrando ? t("cuenta.cerrando") : t("header.cerrar_sesion")}
      </button>
    </div>
  );
}
