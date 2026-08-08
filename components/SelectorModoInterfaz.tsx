"use client";

import { Check, Zap, LayoutDashboard } from "lucide-react";
import { useIdioma } from "./LanguageProvider";
import { ModoInterfaz } from "./ModoInterfazProvider";

interface Props {
  valorActual: ModoInterfaz | null;
  guardando: ModoInterfaz | null;
  onElegir: (modo: ModoInterfaz) => void;
}

// Tarjetas de comparación Easy / Completo — se usa tanto en la
// pantalla de bienvenida (post-registro) como en Configuración >
// Apariencia, para que cambiar de modo se sienta como la misma
// decisión en los dos lugares.
export default function SelectorModoInterfaz({
  valorActual,
  guardando,
  onElegir,
}: Props) {
  const { t } = useIdioma();

  return (
    <div className="modo-selector">
      <div
        className={`modo-selector-card modo-selector-easy${valorActual === "easy" ? " modo-selector-activa" : ""}`}
      >
        <span className="modo-selector-icono modo-selector-icono-easy">
          <Zap size={22} />
        </span>
        <h3>{t("modo_interfaz.easy_nombre")}</h3>
        <p className="modo-selector-desc">{t("modo_interfaz.easy_desc")}</p>
        <ul>
          <li><Check size={15} /> {t("modo_interfaz.easy_b1")}</li>
          <li><Check size={15} /> {t("modo_interfaz.easy_b2")}</li>
          <li><Check size={15} /> {t("modo_interfaz.easy_b3")}</li>
          <li><Check size={15} /> {t("modo_interfaz.easy_b4")}</li>
        </ul>
        <button
          type="button"
          className="btn-primary modo-selector-boton modo-selector-boton-easy"
          disabled={guardando !== null || valorActual === "easy"}
          onClick={() => onElegir("easy")}
        >
          {guardando === "easy"
            ? t("modo_interfaz.guardando")
            : valorActual === "easy"
            ? `✓ ${t("idioma.activo")}`
            : `${t("modo_interfaz.elegir")} ${t("modo_interfaz.easy_nombre")}`}
        </button>
      </div>

      <div
        className={`modo-selector-card modo-selector-completo${valorActual === "completo" ? " modo-selector-activa" : ""}`}
      >
        <span className="modo-selector-icono modo-selector-icono-completo">
          <LayoutDashboard size={22} />
        </span>
        <h3>{t("modo_interfaz.completo_nombre")}</h3>
        <p className="modo-selector-desc">{t("modo_interfaz.completo_desc")}</p>
        <ul>
          <li><Check size={15} /> {t("modo_interfaz.completo_b1")}</li>
          <li><Check size={15} /> {t("modo_interfaz.completo_b2")}</li>
          <li><Check size={15} /> {t("modo_interfaz.completo_b3")}</li>
          <li><Check size={15} /> {t("modo_interfaz.completo_b4")}</li>
        </ul>
        <button
          type="button"
          className="btn-secondary modo-selector-boton"
          disabled={guardando !== null || valorActual === "completo"}
          onClick={() => onElegir("completo")}
        >
          {guardando === "completo"
            ? t("modo_interfaz.guardando")
            : valorActual === "completo"
            ? `✓ ${t("idioma.activo")}`
            : `${t("modo_interfaz.elegir")} ${t("modo_interfaz.completo_nombre")}`}
        </button>
      </div>
    </div>
  );
}
