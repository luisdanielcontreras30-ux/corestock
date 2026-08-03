"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIdioma } from "./LanguageProvider";

// Frases con personalidad + consejos reales de negocio — para que no
// se sienta como un adorno mudo sino como parte del Asistente.
const CLAVES_MENSAJES = [
  "asistente.mascota.frase1",
  "asistente.mascota.frase2",
  "asistente.mascota.frase3",
  "asistente.mascota.frase4",
  "asistente.mascota.frase5",
  "asistente.mascota.frase6",
  "asistente.mascota.consejo1",
  "asistente.mascota.consejo2",
  "asistente.mascota.consejo3",
  "asistente.mascota.consejo4",
];

// Recorre el perímetro de la pantalla en un solo sentido — piso ->
// pared derecha -> techo -> pared izquierda -> piso — para que nunca
// se meta por encima del hilo de la conversación, que vive en el
// centro. En el piso camina/se sienta normal; en las paredes y el
// techo escala/cuelga sostenida con los brazos.
type Zona = "suelo" | "pared-derecha" | "techo" | "pared-izquierda";
type Postura = "sentado" | "caminando" | "escalando" | "colgando";

interface Posicion {
  x: number;
  y: number;
}

const MARGEN_LATERAL = 20;
const ANCHO_PERSONAJE = 46;
// Margen superior para no taparle a nadie el encabezado, e inferior
// para no meterse bajo el campo de escritura / barra de pestañas.
const MARGEN_SUPERIOR_PX = 90;
const MARGEN_INFERIOR_PX = 110;

function calcularLimites() {
  if (typeof window === "undefined") {
    return { maxX: 300, minY: 150, maxY: 400 };
  }

  const maxX = Math.max(MARGEN_LATERAL, window.innerWidth - ANCHO_PERSONAJE - MARGEN_LATERAL);
  const minY = MARGEN_SUPERIOR_PX;
  const maxY = Math.max(minY + 40, window.innerHeight - MARGEN_INFERIOR_PX);

  return { maxX, minY, maxY };
}

function posicionEnZona(zona: Zona): Posicion {
  const { maxX, minY, maxY } = calcularLimites();

  switch (zona) {
    case "pared-derecha":
      return { x: maxX, y: minY + Math.random() * (maxY - minY) };
    case "techo":
      return { x: MARGEN_LATERAL + Math.random() * (maxX - MARGEN_LATERAL), y: minY };
    case "pared-izquierda":
      return { x: MARGEN_LATERAL, y: minY + Math.random() * (maxY - minY) };
    case "suelo":
    default:
      return { x: MARGEN_LATERAL + Math.random() * (maxX - MARGEN_LATERAL), y: maxY };
  }
}

function siguienteZona(zona: Zona): Zona {
  const orden: Zona[] = ["suelo", "pared-derecha", "techo", "pared-izquierda"];
  return orden[(orden.indexOf(zona) + 1) % orden.length];
}

function posturaDeZona(zona: Zona, enMovimiento: boolean): Postura {
  if (zona === "techo") return "colgando";
  if (zona === "pared-derecha" || zona === "pared-izquierda") return "escalando";
  return enMovimiento ? "caminando" : "sentado";
}

// Corebot, la mascota del Asistente IA: mientras no se está
// escribiendo, recorre los bordes de la pantalla — nunca por encima
// del chat — sentándose o escalando/colgándose según el tramo, y a
// veces suelta un consejo solo. Si se le toca, reacciona con un salto
// y dice una frase o un consejo. `activo` lo decide
// app/asistente/page.tsx (se esconde en cuanto la persona escribe).
export default function MascotaAsistente({ activo }: { activo: boolean }) {
  const { t } = useIdioma();
  const [zona, setZona] = useState<Zona>("suelo");
  const [posicion, setPosicion] = useState<Posicion>(() => posicionEnZona("suelo"));
  const [mirandoIzquierda, setMirandoIzquierda] = useState(false);
  const [enMovimiento, setEnMovimiento] = useState(false);
  const [reaccionando, setReaccionando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prefiereMenosMovimientoRef = useRef(false);
  const zonaRef = useRef<Zona>("suelo");
  const posicionRef = useRef<Posicion>(posicion);

  useEffect(() => {
    prefiereMenosMovimientoRef.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    zonaRef.current = zona;
  }, [zona]);

  useEffect(() => {
    posicionRef.current = posicion;
  }, [posicion]);

  const limpiarTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const programar = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timeoutsRef.current.push(id);
  }, []);

  const decirAlgoAlAzar = useCallback(() => {
    const clave = CLAVES_MENSAJES[Math.floor(Math.random() * CLAVES_MENSAJES.length)];
    setMensaje(t(clave));
    programar(() => setMensaje(null), 4200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programar]);

  // Ciclo de vida: se queda quieta unos segundos (a veces dice algo
  // sin que nadie la toque) -> avanza al siguiente tramo del
  // perímetro -> vuelve a quedarse quieta, y así en bucle. Se llama a
  // sí misma por dentro de un setTimeout, así que se guarda en un ref
  // (en vez de que la función se referencie a sí misma por su propio
  // nombre) para que el linter no la marque como usada antes de
  // declararse.
  const cicloRef = useRef<() => void>(() => {});

  const ciclo = useCallback(() => {
    if (prefiereMenosMovimientoRef.current) return;

    setEnMovimiento(false);
    if (Math.random() < 0.4) decirAlgoAlAzar();

    programar(() => {
      const nuevaZona = siguienteZona(zonaRef.current);
      const nuevaPosicion = posicionEnZona(nuevaZona);

      if (nuevaZona === "pared-derecha") {
        setMirandoIzquierda(true);
      } else if (nuevaZona === "pared-izquierda") {
        setMirandoIzquierda(false);
      } else {
        setMirandoIzquierda(nuevaPosicion.x < posicionRef.current.x);
      }

      setZona(nuevaZona);
      setPosicion(nuevaPosicion);
      setEnMovimiento(true);

      programar(() => cicloRef.current(), 2600);
    }, 3000 + Math.random() * 3000);
  }, [programar, decirAlgoAlAzar]);

  useEffect(() => {
    cicloRef.current = ciclo;
  }, [ciclo]);

  useEffect(() => {
    if (!activo) {
      limpiarTimeouts();
      setEnMovimiento(false);
      setReaccionando(false);
      setMensaje(null);
      return;
    }

    cicloRef.current();
    return limpiarTimeouts;
  }, [activo, limpiarTimeouts]);

  function alTocar() {
    setReaccionando(true);
    decirAlgoAlAzar();
    programar(() => setReaccionando(false), 900);
  }

  if (!activo) return null;

  const postura = posturaDeZona(zona, enMovimiento);

  return (
    <button
      type="button"
      className={`mascota-personaje mascota-${postura}${reaccionando ? " mascota-reaccion" : ""}${
        mirandoIzquierda ? " mascota-volteada" : ""
      }`}
      style={{ left: posicion.x, top: posicion.y }}
      onClick={alTocar}
      aria-label={t("asistente.mascota.aria")}
    >
      <span className="mascota-cabeza">
        <span className="mascota-antena" aria-hidden="true" />
        <span className="mascota-oreja mascota-oreja-izq" aria-hidden="true" />
        <span className="mascota-oreja mascota-oreja-der" aria-hidden="true" />
        <span className="mascota-pantalla" aria-hidden="true">
          <span className="mascota-ojo" />
          <span className="mascota-ojo" />
        </span>
      </span>

      <span className="mascota-cuerpo" aria-hidden="true">
        <span className="mascota-brazo mascota-brazo-izq" />
        <span className="mascota-marca" />
        <span className="mascota-brazo mascota-brazo-der" />
      </span>

      <span className="mascota-patas" aria-hidden="true">
        <span className="mascota-pata" />
        <span className="mascota-pata" />
      </span>

      {mensaje && <span className="mascota-globo">{mensaje}</span>}
    </button>
  );
}
