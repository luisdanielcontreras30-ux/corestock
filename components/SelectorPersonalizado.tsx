"use client";

import {
  Children,
  CSSProperties,
  Fragment,
  KeyboardEvent,
  ReactNode,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import { useIdioma } from "./LanguageProvider";
import { normalizarTexto } from "../lib/normalizarTexto";

// En Android, un <select> nativo sin "size" abre el picker propio del
// sistema operativo en vez de un dropdown dentro de la página — ese
// picker no respeta el tema/colores de la app (queda oscuro aunque la
// app esté en un tema claro, o viceversa), sin ninguna forma de
// arreglarlo por CSS. Este componente reemplaza <select>/<option> con
// el mismo patrón de props (value/onChange/children) para que
// convertir un <select> existente sea casi un cambio de nombre de
// etiqueta, pero renderiza su propio menú — siempre con la apariencia
// del resto de la app, en cualquier dispositivo.

// A partir de cuántas opciones vale la pena mostrar la caja de
// búsqueda — selectores chicos (método de pago, sí/no, idioma) no la
// necesitan y solo estorbarían.
const UMBRAL_BUSQUEDA = 8;

// Debe coincidir con el max-height de .selector-personalizado-panel en
// globals.css — se usa para decidir si abrir hacia arriba.
const ALTURA_MAXIMA_PANEL = 320;

interface OpcionSelectorProps {
  value: string | number;
  children: ReactNode;
  disabled?: boolean;
  // Agrupa visualmente esta opción bajo un encabezado (ej. la
  // categoría del producto) — opciones consecutivas con el mismo
  // grupo comparten un solo encabezado. Sin este prop la opción no
  // lleva encabezado, igual que antes.
  grupo?: string;
}

export function OpcionSelector({}: OpcionSelectorProps) {
  // Nunca se monta directo: SelectorPersonalizado lee sus props desde
  // los children para armar la lista, igual que el navegador lee las
  // <option> de un <select> nativo.
  return null;
}

interface SelectorPersonalizadoProps {
  value: string;
  onChange: (valor: string) => void;
  children: ReactNode;
  className?: string;
  // El panel se renderiza en un portal a document.body (ver abrir()),
  // así que ya no es descendiente del elemento que recibe "className"
  // — un override por ancestría CSS (ej. ".landing-nav .selector-...")
  // ya no le llegaría. Esta prop es para esos casos: se aplica directo
  // sobre el panel portado.
  panelClassName?: string;
  style?: CSSProperties;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

interface OpcionInterna {
  valor: string;
  etiqueta: ReactNode;
  disabled: boolean;
  grupo?: string;
}

interface PosicionPanel {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
}

// Extrae el texto visible de una opción (que puede combinar strings,
// números y traducciones) para poder compararlo contra la búsqueda —
// cubre los casos reales de uso en la app (texto plano o mezcla de
// {variable} y texto), no JSX arbitrario con íconos.
function textoPlano(nodo: ReactNode): string {
  if (nodo === null || nodo === undefined || typeof nodo === "boolean") return "";
  if (typeof nodo === "string" || typeof nodo === "number") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(textoPlano).join(" ");
  if (isValidElement(nodo)) {
    const props = nodo.props as { children?: ReactNode };
    return textoPlano(props.children);
  }
  return "";
}

export default function SelectorPersonalizado({
  value,
  onChange,
  children,
  className,
  panelClassName,
  style,
  disabled,
  id,
  ...resto
}: SelectorPersonalizadoProps) {
  const { t } = useIdioma();
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [posicion, setPosicion] = useState<PosicionPanel | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  const busquedaRef = useRef<HTMLInputElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  const opciones: OpcionInterna[] = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const props = child.props as OpcionSelectorProps;
      return {
        valor: String(props.value),
        etiqueta: props.children,
        disabled: !!props.disabled,
        grupo: props.grupo,
      };
    });

  const mostrarBusqueda = opciones.length > UMBRAL_BUSQUEDA;

  // normalizarTexto ignora acentos — sin esto, buscar "cafe" no
  // encontraba "Café" (muy común al escribir rápido o desde un
  // teclado que no pone tildes fácil).
  const terminoBusqueda = normalizarTexto(busqueda.trim());
  const opcionesFiltradas =
    mostrarBusqueda && terminoBusqueda
      ? opciones.filter(
          (o) =>
            normalizarTexto(textoPlano(o.etiqueta)).includes(terminoBusqueda) ||
            normalizarTexto(o.grupo ?? "").includes(terminoBusqueda)
        )
      : opciones;

  const indiceSeleccionado = opciones.findIndex((o) => o.valor === value);
  const seleccionada = indiceSeleccionado !== -1 ? opciones[indiceSeleccionado] : null;

  useEffect(() => {
    function alHacerClicFuera(e: MouseEvent) {
      const objetivo = e.target as Node;
      // El panel ahora se renderiza en un portal fuera de contenedorRef
      // (ver abrir()) — sin este segundo chequeo, cualquier clic dentro
      // del panel (elegir una opción, escribir en el buscador) se
      // interpretaba como "clic afuera" y lo cerraba de inmediato.
      const dentroDelPanel = panelRef.current?.contains(objetivo);
      const dentroDelBoton = contenedorRef.current?.contains(objetivo);
      if (!dentroDelBoton && !dentroDelPanel) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () => document.removeEventListener("mousedown", alHacerClicFuera);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    // Con el panel en un portal, su posición se calcula una sola vez al
    // abrir (ver abrir()) — si la página se desplaza o cambia de
    // tamaño mientras está abierto, cerrarlo es más simple y seguro
    // que perseguir al botón con un recálculo continuo.
    function cerrarPorScrollOResize() {
      setAbierto(false);
    }
    window.addEventListener("scroll", cerrarPorScrollOResize, true);
    window.addEventListener("resize", cerrarPorScrollOResize);
    return () => {
      window.removeEventListener("scroll", cerrarPorScrollOResize, true);
      window.removeEventListener("resize", cerrarPorScrollOResize);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    // No se puede indexar listaRef.current.children[resaltado] directo:
    // los encabezados de grupo son <li> intercalados en el mismo <ul>,
    // así que el índice del DOM ya no coincide con el índice dentro de
    // opcionesFiltradas en cuanto hay más de un grupo.
    const el = listaRef.current?.querySelectorAll(".selector-personalizado-opcion")[
      resaltado
    ] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [abierto, resaltado]);

  useEffect(() => {
    if (abierto && mostrarBusqueda) {
      busquedaRef.current?.focus();
    }
  }, [abierto, mostrarBusqueda]);

  function abrir() {
    setBusqueda("");
    const indiceEnFiltradas = opciones.findIndex((o) => o.valor === value);
    setResaltado(indiceEnFiltradas !== -1 ? indiceEnFiltradas : 0);

    const rect = contenedorRef.current?.getBoundingClientRect();
    if (rect) {
      // El panel se renderiza en un portal a document.body (ver más
      // abajo) en vez de como hijo directo de este selector — con
      // position:absolute normal, cualquier tarjeta que viniera
      // después en el mismo layout de flexbox de la página (todas las
      // páginas usan <main style={{display:"flex", flexDirection:
      // "column"}}>) terminaba pintándose ENCIMA del panel abierto,
      // aunque su z-index fuera más alto: la spec de flexbox trata a
      // cada tarjeta como si tuviera su propio contexto de apilamiento,
      // así que el panel (aunque escapaba visualmente de su tarjeta)
      // quedaba atrapado detrás de la tarjeta siguiente. Portal +
      // position:fixed con coordenadas calculadas aquí evita el
      // problema por completo: el panel deja de ser descendiente de
      // ninguna tarjeta.
      const espacioAbajo = window.innerHeight - rect.bottom;
      const espacioArriba = rect.top;
      const abrirHaciaArriba = espacioAbajo < ALTURA_MAXIMA_PANEL && espacioArriba > espacioAbajo;

      setPosicion(
        abrirHaciaArriba
          ? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 6 }
          : { left: rect.left, width: rect.width, top: rect.bottom + 6 }
      );
    }

    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    setBusqueda("");
    // El buscador (cuando está presente) se lleva el foco al abrir —
    // sin esto, Escape o elegir una opción por teclado lo dejaban en
    // <body>, rompiendo el orden de tabulación del resto del formulario.
    botonRef.current?.focus();
  }

  function elegir(opcion: OpcionInterna) {
    if (opcion.disabled) return;
    onChange(opcion.valor);
    cerrar();
  }

  function manejarNavegacion(e: KeyboardEvent): boolean {
    if (e.key === "Escape") {
      e.preventDefault();
      cerrar();
      return true;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setResaltado((i) => Math.min(opcionesFiltradas.length - 1, i + 1));
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltado((i) => Math.max(0, i - 1));
      return true;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opcion = opcionesFiltradas[resaltado];
      if (opcion) elegir(opcion);
      return true;
    }
    return false;
  }

  function alPresionarTecla(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    if (!abierto) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        abrir();
      }
      return;
    }

    if (e.key === " ") {
      e.preventDefault();
      const opcion = opcionesFiltradas[resaltado];
      if (opcion) elegir(opcion);
      return;
    }

    manejarNavegacion(e);
  }

  function alPresionarTeclaBusqueda(e: KeyboardEvent<HTMLInputElement>) {
    manejarNavegacion(e);
  }

  let grupoAnterior: string | undefined;

  return (
    <div
      ref={contenedorRef}
      className={`selector-personalizado${className ? ` ${className}` : ""}`}
      style={style}
    >
      <button
        ref={botonRef}
        type="button"
        id={id}
        className="selector-personalizado-boton"
        style={style}
        onClick={() => {
          if (disabled) return;
          if (abierto) cerrar();
          else abrir();
        }}
        onKeyDown={alPresionarTecla}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={resto["aria-label"]}
      >
        <span
          className={`selector-personalizado-texto${seleccionada ? "" : " selector-personalizado-placeholder"}`}
        >
          {seleccionada ? seleccionada.etiqueta : ""}
        </span>
        <ChevronDown
          size={16}
          className="selector-personalizado-flecha"
          style={{ transform: abierto ? "rotate(180deg)" : undefined }}
        />
      </button>

      {abierto &&
        posicion &&
        createPortal(
          <div
            ref={panelRef}
            className={`selector-personalizado-panel${panelClassName ? ` ${panelClassName}` : ""}`}
            style={{
              position: "fixed",
              left: posicion.left,
              width: posicion.width,
              top: posicion.top,
              bottom: posicion.bottom,
            }}
          >
            {mostrarBusqueda && (
              <div className="selector-personalizado-busqueda-envoltura">
                <Search size={14} className="selector-personalizado-busqueda-icono" />
                <input
                  ref={busquedaRef}
                  type="text"
                  className="selector-personalizado-busqueda"
                  placeholder={t("comun.buscar")}
                  value={busqueda}
                  onChange={(e) => {
                    // Al escribir, la opción resaltada anterior puede ya
                    // no estar visible — sin este ajuste, Enter podía
                    // "elegir" una opción que ni siquiera se veía.
                    setBusqueda(e.target.value);
                    setResaltado(0);
                  }}
                  onKeyDown={alPresionarTeclaBusqueda}
                />
              </div>
            )}

            <ul className="selector-personalizado-lista" role="listbox" ref={listaRef}>
              {opcionesFiltradas.length === 0 ? (
                <li className="selector-personalizado-sin-resultados">
                  {t("comun.sin_resultados")}
                </li>
              ) : (
                opcionesFiltradas.map((opcion, i) => {
                  const mostrarEncabezado = opcion.grupo !== undefined && opcion.grupo !== grupoAnterior;
                  grupoAnterior = opcion.grupo;

                  return (
                    <Fragment key={opcion.valor}>
                      {mostrarEncabezado && (
                        <li className="selector-personalizado-grupo" role="presentation">
                          {opcion.grupo}
                        </li>
                      )}
                      <li
                        role="option"
                        aria-selected={opcion.valor === value}
                        className={[
                          "selector-personalizado-opcion",
                          opcion.valor === value ? "selector-personalizado-opcion-activa" : "",
                          opcion.disabled ? "selector-personalizado-opcion-deshabilitada" : "",
                          i === resaltado ? "selector-personalizado-opcion-resaltada" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onMouseEnter={() => setResaltado(i)}
                        onClick={() => elegir(opcion)}
                      >
                        {opcion.etiqueta}
                      </li>
                    </Fragment>
                  );
                })
              )}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}
