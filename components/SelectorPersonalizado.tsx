"use client";

import {
  Children,
  CSSProperties,
  KeyboardEvent,
  ReactNode,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";
import { ChevronDown } from "lucide-react";

// En Android, un <select> nativo sin "size" abre el picker propio del
// sistema operativo en vez de un dropdown dentro de la página — ese
// picker no respeta el tema/colores de la app (queda oscuro aunque la
// app esté en un tema claro, o viceversa), sin ninguna forma de
// arreglarlo por CSS. Este componente reemplaza <select>/<option> con
// el mismo patrón de props (value/onChange/children) para que
// convertir un <select> existente sea casi un cambio de nombre de
// etiqueta, pero renderiza su propio menú — siempre con la apariencia
// del resto de la app, en cualquier dispositivo.

interface OpcionSelectorProps {
  value: string | number;
  children: ReactNode;
  disabled?: boolean;
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
  style?: CSSProperties;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

interface OpcionInterna {
  valor: string;
  etiqueta: ReactNode;
  disabled: boolean;
}

export default function SelectorPersonalizado({
  value,
  onChange,
  children,
  className,
  style,
  disabled,
  id,
  ...resto
}: SelectorPersonalizadoProps) {
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  const opciones: OpcionInterna[] = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const props = child.props as OpcionSelectorProps;
      return { valor: String(props.value), etiqueta: props.children, disabled: !!props.disabled };
    });

  const indiceSeleccionado = opciones.findIndex((o) => o.valor === value);
  const seleccionada = indiceSeleccionado !== -1 ? opciones[indiceSeleccionado] : null;

  useEffect(() => {
    function alHacerClicFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () => document.removeEventListener("mousedown", alHacerClicFuera);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const el = listaRef.current?.children[resaltado] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [abierto, resaltado]);

  function abrir() {
    setResaltado(indiceSeleccionado !== -1 ? indiceSeleccionado : 0);
    setAbierto(true);
  }

  function elegir(opcion: OpcionInterna) {
    if (opcion.disabled) return;
    onChange(opcion.valor);
    setAbierto(false);
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

    if (e.key === "Escape") {
      e.preventDefault();
      setAbierto(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setResaltado((i) => Math.min(opciones.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltado((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opcion = opciones[resaltado];
      if (opcion) elegir(opcion);
    }
  }

  return (
    <div
      ref={contenedorRef}
      className={`selector-personalizado${className ? ` ${className}` : ""}`}
      style={style}
    >
      <button
        type="button"
        id={id}
        className="selector-personalizado-boton"
        style={style}
        onClick={() => {
          if (disabled) return;
          if (abierto) setAbierto(false);
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

      {abierto && (
        <ul className="selector-personalizado-lista" role="listbox" ref={listaRef}>
          {opciones.map((opcion, i) => (
            <li
              key={opcion.valor}
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
          ))}
        </ul>
      )}
    </div>
  );
}
