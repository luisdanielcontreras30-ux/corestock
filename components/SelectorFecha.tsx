"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useIdioma } from "./LanguageProvider";
import { LOCALES } from "../lib/i18n";

// Reemplaza <input type="date">: en Chrome/Android el calendario que
// se abre es un popup nativo del sistema operativo, sin acceso desde
// CSS — ni el color, ni la tipografía, ni el tema oscuro/claro de la
// app le llegan. Se reemplaza por un calendario propio, con el mismo
// patrón de portal + posición que SelectorPersonalizado.tsx (que ya
// hizo lo mismo con <select>).

// Debe coincidir con el max-height de .selector-fecha-panel en
// globals.css — se usa para decidir si el panel abre hacia arriba.
const ALTURA_MAXIMA_PANEL = 340;

interface Props {
  value: string; // "YYYY-MM-DD" o "" si no hay fecha elegida
  onChange: (valor: string) => void;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

interface PosicionPanel {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function aTexto(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "YYYY-MM-DD" se parsea a mano (año, mes, día) en vez de con
// new Date("YYYY-MM-DD"): ese constructor lo interpreta como UTC
// medianoche, que cae un día antes en cualquier huso horario al oeste
// de UTC — el clásico bug de "elegí el 15 y me guardó el 14".
function desdeTexto(v: string): Date | null {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!coincidencia) return null;
  const [, y, m, d] = coincidencia;
  const fecha = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export default function SelectorFecha({
  value,
  onChange,
  className,
  style,
  disabled,
  id,
  ...resto
}: Props) {
  const { t, idioma } = useIdioma();
  const locale = LOCALES[idioma] ?? "es-MX";

  const seleccionada = desdeTexto(value);
  const [abierto, setAbierto] = useState(false);
  const [mesVisible, setMesVisible] = useState(() => seleccionada ?? new Date());
  const [posicion, setPosicion] = useState<PosicionPanel | null>(null);

  const contenedorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function alHacerClicFuera(e: MouseEvent) {
      const objetivo = e.target as Node;
      const dentroDelPanel = panelRef.current?.contains(objetivo);
      const dentroDelBoton = contenedorRef.current?.contains(objetivo);
      if (!dentroDelBoton && !dentroDelPanel) setAbierto(false);
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () => document.removeEventListener("mousedown", alHacerClicFuera);
  }, []);

  // Mismo motivo que en SelectorPersonalizado: en celular, un scroll o
  // resize del sistema (barra de direcciones, teclado) no debe cerrar
  // el panel de golpe — se recoloca en su lugar.
  useEffect(() => {
    if (!abierto) return;

    function alMoverse(e: Event) {
      if (e.type === "scroll" && panelRef.current?.contains(e.target as Node)) return;

      const rect = contenedorRef.current?.getBoundingClientRect();
      if (!rect) return;

      const fueraDeVista = rect.bottom < 0 || rect.top > window.innerHeight;
      if (fueraDeVista) {
        setAbierto(false);
        return;
      }

      setPosicion(calcularPosicion(rect));
    }

    window.addEventListener("scroll", alMoverse, true);
    window.addEventListener("resize", alMoverse);
    return () => {
      window.removeEventListener("scroll", alMoverse, true);
      window.removeEventListener("resize", alMoverse);
    };
  }, [abierto]);

  function calcularPosicion(rect: DOMRect): PosicionPanel {
    const espacioAbajo = window.innerHeight - rect.bottom;
    const espacioArriba = rect.top;
    const abrirHaciaArriba = espacioAbajo < ALTURA_MAXIMA_PANEL && espacioArriba > espacioAbajo;
    const ancho = Math.max(rect.width, 268);

    return abrirHaciaArriba
      ? { left: rect.left, width: ancho, bottom: window.innerHeight - rect.top + 6 }
      : { left: rect.left, width: ancho, top: rect.bottom + 6 };
  }

  function abrir() {
    if (disabled) return;
    setMesVisible(seleccionada ?? new Date());
    const rect = contenedorRef.current?.getBoundingClientRect();
    if (rect) setPosicion(calcularPosicion(rect));
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    botonRef.current?.focus();
  }

  function elegirDia(d: Date) {
    onChange(aTexto(d));
    cerrar();
  }

  function irAHoy() {
    onChange(aTexto(new Date()));
    cerrar();
  }

  function limpiar() {
    onChange("");
    cerrar();
  }

  // Cuadrícula de 6 semanas × 7 días empezando en lunes, con los días
  // sueltos de los meses vecinos para que la grilla siempre quede
  // completa (igual que cualquier calendario de referencia).
  const primerDiaMes = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1);
  const offsetLunes = (primerDiaMes.getDay() + 6) % 7;
  const inicioCuadricula = new Date(primerDiaMes);
  inicioCuadricula.setDate(primerDiaMes.getDate() - offsetLunes);

  const dias: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicioCuadricula);
    d.setDate(inicioCuadricula.getDate() + i);
    return d;
  });

  // 1 de enero de 2024 fue lunes — sirve de referencia fija para sacar
  // los nombres abreviados de los 7 días de la semana en el idioma
  // activo, sin tener que traducirlos a mano.
  const nombresDias = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, 1 + i))
  );

  // Solo la PRIMERA letra en mayúscula: un text-transform:capitalize por
  // CSS mayusculiza cada palabra, y en varios idiomas el nombre del mes
  // trae de por medio una preposición ("agosto de 2026", o en
  // portugués incluso dos: "05 de ago. de 2026") que no debe llevar
  // mayúscula — un text-transform:capitalize por CSS la habría subido
  // igual, en TODAS las palabras.
  const conMayusculaInicial = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
  const etiquetaMes = conMayusculaInicial(
    new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(mesVisible)
  );
  const textoBoton = seleccionada
    ? conMayusculaInicial(
        new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(seleccionada)
      )
    : "";
  const hoyTexto = aTexto(new Date());

  return (
    <div ref={contenedorRef} className={`selector-fecha${className ? ` ${className}` : ""}`} style={style}>
      <button
        ref={botonRef}
        type="button"
        id={id}
        className="selector-fecha-boton"
        onClick={() => (abierto ? cerrar() : abrir())}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={resto["aria-label"]}
      >
        <CalendarIcon size={15} className="selector-fecha-icono" />
        <span className={`selector-fecha-texto${seleccionada ? "" : " selector-fecha-placeholder"}`}>
          {seleccionada ? textoBoton : t("comun.seleccionar_fecha")}
        </span>
      </button>

      {abierto &&
        posicion &&
        createPortal(
          <div
            ref={panelRef}
            className="selector-fecha-panel"
            style={{
              position: "fixed",
              left: posicion.left,
              width: posicion.width,
              top: posicion.top,
              bottom: posicion.bottom,
            }}
          >
            <div className="selector-fecha-cabecera">
              <button
                type="button"
                className="selector-fecha-nav"
                onClick={() => setMesVisible((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                aria-label={t("comun.mes_anterior")}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="selector-fecha-mes">{etiquetaMes}</span>
              <button
                type="button"
                className="selector-fecha-nav"
                onClick={() => setMesVisible((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                aria-label={t("comun.mes_siguiente")}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="selector-fecha-dias-semana">
              {nombresDias.map((n, i) => (
                <span key={i}>{n}</span>
              ))}
            </div>

            <div className="selector-fecha-cuadricula">
              {dias.map((d, i) => {
                const texto = aTexto(d);
                const delMesActual = d.getMonth() === mesVisible.getMonth();
                const esSeleccionado = texto === value;
                const esHoy = texto === hoyTexto;

                return (
                  <button
                    key={i}
                    type="button"
                    className={[
                      "selector-fecha-dia",
                      !delMesActual ? "selector-fecha-dia-fuera" : "",
                      esSeleccionado ? "selector-fecha-dia-activo" : "",
                      esHoy && !esSeleccionado ? "selector-fecha-dia-hoy" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => elegirDia(d)}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="selector-fecha-pie">
              <button type="button" className="selector-fecha-pie-boton" onClick={irAHoy}>
                {t("comun.hoy")}
              </button>
              <button type="button" className="selector-fecha-pie-boton" onClick={limpiar}>
                {t("comun.limpiar")}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
