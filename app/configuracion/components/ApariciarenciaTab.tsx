"use client";

import { useState } from "react";
import { SlidersHorizontal, Palette, BarChart3, Store, LucideIcon } from "lucide-react";
import { useTheme, Tema } from "../../../components/ThemeProvider";
import { useIdioma } from "../../../components/LanguageProvider";
import { useToast } from "../../../components/ToastProvider";
import { useModoInterfaz, ModoInterfaz } from "../../../components/ModoInterfazProvider";
import SelectorModoInterfaz from "../../../components/SelectorModoInterfaz";
import CatalogoAparienciaTab from "./CatalogoAparienciaTab";

type SubSeccion = "interfaz" | "temas" | "graficas" | "catalogo";

const SUBSECCIONES: { id: SubSeccion; clave: string; Icono: LucideIcon }[] = [
  { id: "interfaz", clave: "config.apariencia.tab_interfaz", Icono: SlidersHorizontal },
  { id: "temas", clave: "config.apariencia.tab_temas", Icono: Palette },
  { id: "graficas", clave: "config.apariencia.tab_graficas", Icono: BarChart3 },
  // El color del catálogo público estaba perdido en Empresa, entre el
  // RFC y la zona horaria. Es un ajuste de aspecto y va con los demás.
  { id: "catalogo", clave: "config.apariencia.tab_catalogo", Icono: Store },
];

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
  { valor: "teal", claveNombre: "tema.teal.nombre", claveDesc: "tema.teal.desc", colores: ["#eafbf9", "#ffffff", "#0d9488"] },
  { valor: "matrix", claveNombre: "tema.matrix.nombre", claveDesc: "tema.matrix.desc", colores: ["#000000", "#0a0a0a", "#39ff14"] },
  { valor: "neonpink", claveNombre: "tema.neonpink.nombre", claveDesc: "tema.neonpink.desc", colores: ["#000000", "#0a0a0a", "#ff2df7"] },
  { valor: "neonblue", claveNombre: "tema.neonblue.nombre", claveDesc: "tema.neonblue.desc", colores: ["#000000", "#0a0a0a", "#00baff"] },
  { valor: "neonpurple", claveNombre: "tema.neonpurple.nombre", claveDesc: "tema.neonpurple.desc", colores: ["#000000", "#0a0a0a", "#b026ff"] },
  { valor: "neonorange", claveNombre: "tema.neonorange.nombre", claveDesc: "tema.neonorange.desc", colores: ["#000000", "#0a0a0a", "#ff6a00"] },
  { valor: "rose", claveNombre: "tema.rose.nombre", claveDesc: "tema.rose.desc", colores: ["#fdf1f5", "#ffffff", "#e0729a"] },
  { valor: "ocean", claveNombre: "tema.ocean.nombre", claveDesc: "tema.ocean.desc", colores: ["#041019", "#0a1f2e", "#0ea5e9"] },
  { valor: "coral", claveNombre: "tema.coral.nombre", claveDesc: "tema.coral.desc", colores: ["#fff2ef", "#ffffff", "#ff6f61"] },
  { valor: "lavender", claveNombre: "tema.lavender.nombre", claveDesc: "tema.lavender.desc", colores: ["#f5f2ff", "#ffffff", "#9b8afb"] },
  { valor: "midnight", claveNombre: "tema.midnight.nombre", claveDesc: "tema.midnight.desc", colores: ["#05050f", "#0e0e26", "#818cf8"] },
  { valor: "peach", claveNombre: "tema.peach.nombre", claveDesc: "tema.peach.desc", colores: ["#fff5eb", "#ffffff", "#fb923c"] },
  { valor: "steel", claveNombre: "tema.steel.nombre", claveDesc: "tema.steel.desc", colores: ["#0a0f14", "#131c26", "#38bdf8"] },
  { valor: "ruby", claveNombre: "tema.ruby.nombre", claveDesc: "tema.ruby.desc", colores: ["#120505", "#240d0d", "#dc2626"] },
  { valor: "gold", claveNombre: "tema.gold.nombre", claveDesc: "tema.gold.desc", colores: ["#120e02", "#241c08", "#eab308"] },
  { valor: "ice", claveNombre: "tema.ice.nombre", claveDesc: "tema.ice.desc", colores: ["#eff9ff", "#ffffff", "#0ea5e9"] },
  { valor: "cyberpunk", claveNombre: "tema.cyberpunk.nombre", claveDesc: "tema.cyberpunk.desc", colores: ["#050014", "#0f0329", "#fcee0a"] },
  { valor: "tron", claveNombre: "tema.tron.nombre", claveDesc: "tema.tron.desc", colores: ["#000000", "#061619", "#00f6ff"] },
  { valor: "joker", claveNombre: "tema.joker.nombre", claveDesc: "tema.joker.desc", colores: ["#050208", "#120a1e", "#7cff2e"] },
  { valor: "terminator", claveNombre: "tema.terminator.nombre", claveDesc: "tema.terminator.desc", colores: ["#050505", "#35353c", "#ff0a0a"] },
  { valor: "strangerthings", claveNombre: "tema.strangerthings.nombre", claveDesc: "tema.strangerthings.desc", colores: ["#01050f", "#061024", "#e10600"] },
];

const OPCIONES_TENDENCIA: { valor: "area" | "barras" | "velas"; clave: string }[] = [
  { valor: "area", clave: "tema.grafica_area" },
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
  const [subSeccion, setSubSeccion] = useState<SubSeccion>("interfaz");

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
    <div className="config-tabs">
      {SUBSECCIONES.map((sub) => {
        const Icono = sub.Icono;
        return (
          <button
            key={sub.id}
            className={`config-tab ${subSeccion === sub.id ? "config-tab-active" : ""}`}
            onClick={() => setSubSeccion(sub.id)}
          >
            <Icono size={15} />
            {t(sub.clave)}
          </button>
        );
      })}
    </div>

    {subSeccion === "interfaz" && (
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
    )}

    {subSeccion === "temas" && (
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
        {opciones.map((opcion, indice) => {
          const activo = tema === opcion.valor;

          return (
            <button
              key={opcion.valor}
              onClick={() => cambiarTema(opcion.valor)}
              className="tema-opcion-card fade-up"
              style={{
                textAlign: "left",
                padding: 16,
                borderRadius: "var(--radius-lg)",
                border: activo
                  ? "2px solid var(--primary)"
                  : "1px solid var(--border)",
                background: "var(--card-hover)",
                cursor: "pointer",
                animationDelay: `${Math.min(indice * 0.02, 0.3)}s`,
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
                    className="tema-opcion-activo-pop"
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
    )}

    {subSeccion === "graficas" && (
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
    )}

    {subSeccion === "catalogo" && <CatalogoAparienciaTab />}
    </div>
  );
}
