"use client";

import { useEffect } from "react";
import { LucideIcon } from "lucide-react";
import { useColorModulo, fondoTenue } from "../lib/colorModulo";

interface Props {
  Icono: LucideIcon;
  color: string;
  titulo: string;
  subtitulo: string;
}

// Encabezado compartido por los módulos del sistema — cada uno con su
// propio color de acento (el mismo que usa en la navegación móvil),
// para que cada apartado se distinga a simple vista en vez de que
// todos se vean iguales.
//
// El color que llega por props es el DESEADO, no el definitivo: quien
// decide es lib/colorModulo.ts, que lo respeta en claro y oscuro y lo
// cede al tema activo en los demás. Se resuelve aquí, en un solo sitio,
// y no en cada una de las 27 páginas que usan este encabezado.
export default function EncabezadoModulo({ Icono, color, titulo, subtitulo }: Props) {
  const colorFinal = useColorModulo(color);

  // Se publica como variable CSS para que el resto de la pantalla
  // (botones, bordes e insignias del módulo) pueda teñirse igual desde
  // la hoja de estilos, sin que cada módulo tenga su color escrito a
  // mano — que era justo el problema del naranja de Fabricación.
  //
  // Va en <html> porque solo hay UN encabezado por página; al salir se
  // retira para que la siguiente pantalla no herede el color de la
  // anterior si no trae encabezado propio.
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.style.setProperty("--modulo-color", colorFinal);

    return () => {
      // Solo se retira si sigue siendo EL NUESTRO. Al navegar entre
      // módulos, el encabezado de la pantalla nueva puede montarse antes
      // de que se limpie el de la vieja: borrando a ciegas, la pantalla
      // recién abierta se quedaba sin su color de identidad y caía al
      // del tema hasta el siguiente render.
      if (raiz.style.getPropertyValue("--modulo-color") === colorFinal) {
        raiz.style.removeProperty("--modulo-color");
      }
    };
  }, [colorFinal]);

  return (
    <div className="encabezado-modulo" style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <span
        className="encabezado-modulo-icono"
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: fondoTenue(colorFinal),
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icono size={26} color={colorFinal} />
      </span>
      <div className="encabezado-modulo-texto">
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>{titulo}</h1>
        <p style={{ color: "var(--text-secondary)", margin: "2px 0 0 0" }}>{subtitulo}</p>
      </div>
    </div>
  );
}
