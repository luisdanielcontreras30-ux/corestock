"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { normalizarTexto } from "../lib/normalizarTexto";

// Reemplaza <input list="..."> + <datalist> para escribir un nombre
// libre (proveedor, cliente...) con sugerencias de lo que ya existe.
//
// El datalist nativo se ve bien en escritorio, pero en varios navegadores
// móviles — sobre todo Safari de iPhone — simplemente no muestra ninguna
// sugerencia al tocar el campo: el usuario ve un input vacío y no hay
// forma de saber qué proveedores/clientes ya tiene cargados. Este
// componente dibuja su propia lista, así que se ve igual en cualquier
// dispositivo. El texto sigue siendo libre: escribir algo que no está en
// la lista es válido, igual que con datalist.
//
// Reutiliza el estilo visual de SelectorPersonalizado (mismo panel, en
// portal a document.body para no quedar atrapado detrás de la
// siguiente tarjeta dentro del <main flex> de la página).

const ALTURA_MAXIMA_PANEL = 240;
const MAXIMO_SUGERENCIAS = 8;

interface Props {
  value: string;
  onChange: (valor: string) => void;
  opciones: string[];
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

interface PosicionPanel {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
}

function calcularPosicion(rect: DOMRect): PosicionPanel {
  const espacioAbajo = window.innerHeight - rect.bottom;
  const espacioArriba = rect.top;
  const abrirHaciaArriba = espacioAbajo < ALTURA_MAXIMA_PANEL && espacioArriba > espacioAbajo;

  return abrirHaciaArriba
    ? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 6 }
    : { left: rect.left, width: rect.width, top: rect.bottom + 6 };
}

export default function CampoConSugerencias({
  value,
  onChange,
  opciones,
  placeholder,
  id,
  className,
  disabled,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState<PosicionPanel | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Sin texto todavía se enseñan todas (hasta el tope); ya escribiendo,
  // solo las que contienen lo tecleado — sin acentos, para que "cafe"
  // encuentre "Café".
  const termino = normalizarTexto(value.trim());
  const opcionesUnicas = Array.from(new Set(opciones.filter(Boolean)));
  const filtradas = (
    termino ? opcionesUnicas.filter((o) => normalizarTexto(o).includes(termino)) : opcionesUnicas
  ).slice(0, MAXIMO_SUGERENCIAS);

  useEffect(() => {
    function alHacerClicFuera(e: MouseEvent) {
      const objetivo = e.target as Node;
      const dentroDelPanel = panelRef.current?.contains(objetivo);
      const dentroDelInput = inputRef.current?.contains(objetivo);
      if (!dentroDelInput && !dentroDelPanel) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () => document.removeEventListener("mousedown", alHacerClicFuera);
  }, []);

  useEffect(() => {
    if (!abierto) return;

    // Mismo motivo que en SelectorPersonalizado: en celular, cerrar el
    // panel ante cualquier scroll/resize lo vuelve inutilizable (el
    // teclado del sistema dispara "resize" solo). Se reposiciona en vez
    // de cerrarse, y solo se cierra si el input se salió de la pantalla.
    function alMoverse(e: Event) {
      if (e.type === "scroll" && panelRef.current?.contains(e.target as Node)) return;

      const rect = inputRef.current?.getBoundingClientRect();
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

  function abrir() {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) setPosicion(calcularPosicion(rect));
    setAbierto(true);
  }

  function elegir(opcion: string) {
    onChange(opcion);
    setAbierto(false);
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        ref={inputRef}
        id={id}
        className={className}
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          if (!abierto) abrir();
        }}
        onFocus={abrir}
        autoComplete="off"
      />

      {abierto &&
        posicion &&
        filtradas.length > 0 &&
        createPortal(
          <div
            ref={panelRef}
            className="selector-personalizado-panel"
            style={{
              position: "fixed",
              left: posicion.left,
              width: posicion.width,
              top: posicion.top,
              bottom: posicion.bottom,
              maxHeight: ALTURA_MAXIMA_PANEL,
            }}
          >
            <ul className="selector-personalizado-lista" role="listbox">
              {filtradas.map((opcion) => (
                <li
                  key={opcion}
                  role="option"
                  aria-selected={opcion === value}
                  className={[
                    "selector-personalizado-opcion",
                    opcion === value ? "selector-personalizado-opcion-activa" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  // mousedown en vez de click: dispara ANTES que el blur
                  // del input, así elegir una opción no se pierde contra
                  // el cierre del panel.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    elegir(opcion);
                  }}
                >
                  {opcion}
                </li>
              ))}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}
