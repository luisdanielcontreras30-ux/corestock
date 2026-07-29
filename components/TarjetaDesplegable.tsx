"use client";

import { ReactNode, useId, useState } from "react";
import { ChevronDown, LucideIcon } from "lucide-react";
import { fondoTenue } from "../lib/colorModulo";

interface Props {
  Icono?: LucideIcon;
  titulo: string;
  subtitulo?: string;
  // Color de acento. Por defecto el del módulo abierto, que ya resuelve
  // EncabezadoModulo según el tema (ver lib/colorModulo.ts).
  color?: string;
  abiertaPorDefecto?: boolean;
  children: ReactNode;
}

// Tarjeta que se abre y se cierra, con la flecha que gira.
//
// Existe porque en la app no había NINGUNA: los módulos apilaban
// formularios siempre abiertos, y en un celular eso significa bajar
// media pantalla de campos vacíos antes de llegar a los datos. La
// flecha es la parte que no se puede omitir: sin ella nadie sabe que la
// tarjeta se puede plegar, y una zona que reacciona al toque sin
// anunciarlo se siente rota, no plegable.
export default function TarjetaDesplegable({
  Icono,
  titulo,
  subtitulo,
  color = "var(--modulo-color)",
  abiertaPorDefecto = true,
  children,
}: Props) {
  const [abierta, setAbierta] = useState(abiertaPorDefecto);
  const idContenido = useId();

  return (
    <div className={`card tarjeta-desplegable ${abierta ? "tarjeta-desplegable-abierta" : ""}`}>
      <button
        type="button"
        className="tarjeta-desplegable-cabecera"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        aria-controls={idContenido}
      >
        {Icono && (
          <span
            className="tarjeta-desplegable-icono"
            style={{ background: fondoTenue(color), color }}
          >
            <Icono size={18} />
          </span>
        )}

        <span className="tarjeta-desplegable-textos">
          <span className="tarjeta-desplegable-titulo">{titulo}</span>
          {subtitulo && <span className="tarjeta-desplegable-subtitulo">{subtitulo}</span>}
        </span>

        <ChevronDown size={20} className="tarjeta-desplegable-flecha" aria-hidden="true" />
      </button>

      {/* Se desmonta al cerrar en vez de ocultarse con CSS: así los
          campos de dentro no siguen siendo enfocables con el teclado ni
          los lee un lector de pantalla cuando no se ven. */}
      {abierta && (
        <div className="tarjeta-desplegable-cuerpo" id={idContenido}>
          {children}
        </div>
      )}
    </div>
  );
}
