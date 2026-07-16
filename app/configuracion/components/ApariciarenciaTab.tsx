"use client";

import { useState } from "react";
import { useTheme, Tema } from "../../../components/ThemeProvider";
import { useIdioma } from "../../../components/LanguageProvider";
import { useToast } from "../../../components/ToastProvider";
import { useModoInterfaz, ModoInterfaz } from "../../../components/ModoInterfazProvider";
import SelectorModoInterfaz from "../../../components/SelectorModoInterfaz";

interface OpcionTema {
  valor: Tema;
  claveNombre: string;
  claveDesc: string;
  colores: string[];
}

const opciones: OpcionTema[] = [
  { valor: "dark", claveNombre: "tema.dark.nombre", claveDesc: "tema.dark.desc", colores: ["#090a14", "#121424", "#5945e4"] },
  { valor: "green", claveNombre: "tema.green.nombre", claveDesc: "tema.green.desc", colores: ["#071310", "#0e231c", "#10b981"] },
  { valor: "blue", claveNombre: "tema.blue.nombre", claveDesc: "tema.blue.desc", colores: ["#060b16", "#101a2e", "#3b82f6"] },
  { valor: "purple", claveNombre: "tema.purple.nombre", claveDesc: "tema.purple.desc", colores: ["#0f0817", "#1d1129", "#a855f7"] },
  { valor: "amber", claveNombre: "tema.amber.nombre", claveDesc: "tema.amber.desc", colores: ["#150f08", "#251b0f", "#f59e0b"] },
  { valor: "slate", claveNombre: "tema.slate.nombre", claveDesc: "tema.slate.desc", colores: ["#0b0d10", "#171b20", "#64748b"] },
  { valor: "cyan", claveNombre: "tema.cyan.nombre", claveDesc: "tema.cyan.desc", colores: ["#061417", "#0d262b", "#06b6d4"] },
  { valor: "wine", claveNombre: "tema.wine.nombre", claveDesc: "tema.wine.desc", colores: ["#150609", "#271015", "#e11d48"] },
  { valor: "light", claveNombre: "tema.light.nombre", claveDesc: "tema.light.desc", colores: ["#eef0f9", "#ffffff", "#5945e4"] },
  { valor: "pink", claveNombre: "tema.pink.nombre", claveDesc: "tema.pink.desc", colores: ["#f4a9cf", "#fce3ee", "#c2255f"] },
  { valor: "mint", claveNombre: "tema.mint.nombre", claveDesc: "tema.mint.desc", colores: ["#eafaf3", "#ffffff", "#10b981"] },
  { valor: "sunset", claveNombre: "tema.sunset.nombre", claveDesc: "tema.sunset.desc", colores: ["#170a05", "#2a150a", "#f97316"] },
];

const OPCIONES_TENDENCIA: { valor: "area" | "linea" | "barras" | "velas"; clave: string }[] = [
  { valor: "area", clave: "tema.grafica_area" },
  { valor: "linea", clave: "tema.grafica_linea" },
  { valor: "barras", clave: "tema.grafica_barras" },
  { valor: "velas", clave: "tema.grafica_velas" },
];

const OPCIONES_DISTRIBUCION: { valor: "pastel" | "barras"; clave: string }[] = [
  { valor: "pastel", clave: "tema.grafica_pastel" },
  { valor: "barras", clave: "tema.grafica_barras" },
];

export default function ApariciarenciaTab() {
  const {
    tema,
    cambiarTema,
    tipoTendencia,
    cambiarTipoTendencia,
    tipoDistribucion,
    cambiarTipoDistribucion,
  } = useTheme();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { modoInterfaz, cambiarModo } = useModoInterfaz();
  const [guardandoModo, setGuardandoModo] = useState<ModoInterfaz | null>(null);

  async function elegirModo(modo: ModoInterfaz) {
    if (guardandoModo || modo === modoInterfaz) return;
    setGuardandoModo(modo);

    try {
      await cambiarModo(modo);
      mostrarToast(t("modo_interfaz.msg_guardado"), "exito");
    } catch (error) {
      console.error(error);
      mostrarToast(t("modo_interfaz.msg_error"), "error");
    } finally {
      setGuardandoModo(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
    <div className="card">
      <h2 style={{ marginBottom: 6 }}>{t("configuracion.modo_interfaz_titulo")}</h2>
      <p
        style={{
          color: "var(--text-secondary)",
          marginBottom: 20,
          fontSize: 13,
        }}
      >
        {t("configuracion.modo_interfaz_subtitulo")}
      </p>

      <SelectorModoInterfaz
        valorActual={modoInterfaz}
        guardando={guardandoModo}
        onElegir={elegirModo}
      />
    </div>

    <div className="card">
      <h2 style={{ marginBottom: 6 }}>{t("tema.titulo")}</h2>
      <p
        style={{
          color: "var(--text-secondary)",
          marginBottom: 20,
          fontSize: 13,
        }}
      >
        {t("tema.subtitulo")}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        {opciones.map((opcion) => {
          const activo = tema === opcion.valor;

          return (
            <button
              key={opcion.valor}
              onClick={() => cambiarTema(opcion.valor)}
              style={{
                textAlign: "left",
                padding: 16,
                borderRadius: "var(--radius-lg)",
                border: activo
                  ? "2px solid var(--primary)"
                  : "1px solid var(--border)",
                background: "var(--card-hover)",
                cursor: "pointer",
                transition:
                  "border-color .2s ease, transform .15s ease",
              }}
            >
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {opcion.colores.map((c, i) => (
                  <span
                    key={i}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: c,
                      border: "1px solid rgba(255,255,255,0.15)",
                      display: "inline-block",
                    }}
                  />
                ))}
              </div>

              <p
                style={{
                  color: "var(--text-primary)",
                  fontWeight: 700,
                  fontSize: 15,
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {t(opcion.claveNombre)}
                {activo && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--primary)",
                      fontWeight: 700,
                    }}
                  >
                    ● {t("idioma.activo")}
                  </span>
                )}
              </p>

              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: 12.5,
                  margin: "4px 0 0 0",
                }}
              >
                {t(opcion.claveDesc)}
              </p>
            </button>
          );
        })}
      </div>
    </div>

    <div className="card">
      <h2 style={{ marginBottom: 6 }}>{t("tema.graficas_titulo")}</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: 20, fontSize: 13 }}>
        {t("tema.graficas_subtitulo")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>{t("tema.grafica_tendencia")}</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 10 }}>{t("tema.grafica_tendencia_desc")}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {OPCIONES_TENDENCIA.map((opcion) => (
              <button
                key={opcion.valor}
                onClick={() => cambiarTipoTendencia(opcion.valor)}
                className={tipoTendencia === opcion.valor ? "btn-primary" : "btn-secondary"}
              >
                {t(opcion.clave)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>{t("tema.grafica_distribucion")}</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 10 }}>{t("tema.grafica_distribucion_desc")}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {OPCIONES_DISTRIBUCION.map((opcion) => (
              <button
                key={opcion.valor}
                onClick={() => cambiarTipoDistribucion(opcion.valor)}
                className={tipoDistribucion === opcion.valor ? "btn-primary" : "btn-secondary"}
              >
                {t(opcion.clave)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
