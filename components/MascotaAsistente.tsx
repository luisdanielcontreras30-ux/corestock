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

type Estado = "sentado" | "caminando";

interface Posicion {
  x: number;
  y: number;
}

const MARGEN_LATERAL = 24;
const ANCHO_PERSONAJE = 46;
// Deambula en la mitad inferior de la pantalla — nunca tan arriba
// como para taparle a alguien el encabezado o el hilo de la
// conversación, y con margen abajo para no meterse bajo la barra de
// pestañas móvil.
const ZONA_VERTICAL_MIN = 0.48;
const MARGEN_INFERIOR_PX = 110;

function posicionAleatoria(): Posicion {
  if (typeof window === "undefined") {
    return { x: MARGEN_LATERAL, y: 400 };
  }

  const maxX = Math.max(MARGEN_LATERAL, window.innerWidth - ANCHO_PERSONAJE - MARGEN_LATERAL);
  const minY = window.innerHeight * ZONA_VERTICAL_MIN;
  const maxY = Math.max(minY + 40, window.innerHeight - MARGEN_INFERIOR_PX);

  return {
    x: MARGEN_LATERAL + Math.random() * (maxX - MARGEN_LATERAL),
    y: minY + Math.random() * (maxY - minY),
  };
}

// Corebot, la mascota del Asistente IA: mientras no se está
// escribiendo, deambula por la pantalla — camina a un punto nuevo,
// se sienta un rato, y a veces suelta un consejo solo — en vez de un
// ida-y-vuelta fijo de un lado a otro. Si se le toca, reacciona con
// un salto y dice una frase o un consejo. `activo` lo decide
// app/asistente/page.tsx (se esconde en cuanto la persona escribe).
export default function MascotaAsistente({ activo }: { activo: boolean }) {
  const { t } = useIdioma();
  const [posicion, setPosicion] = useState<Posicion>(() => posicionAleatoria());
  const [mirandoIzquierda, setMirandoIzquierda] = useState(false);
  const [estado, setEstado] = useState<Estado>("sentado");
  const [reaccionando, setReaccionando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prefiereMenosMovimientoRef = useRef(false);

  useEffect(() => {
    prefiereMenosMovimientoRef.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

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

  // Ciclo de vida: se sienta unos segundos (a veces dice algo sin que
  // nadie la toque) -> camina a un punto nuevo -> se vuelve a sentar,
  // y así — nunca un recorrido fijo de lado a lado. Se llama a sí
  // mismo por dentro de un setTimeout, así que se guarda en un ref
  // (en vez de que la función se referencie a sí misma por su propio
  // nombre) para que el linter no la marque como usada antes de
  // declararse.
  const cicloRef = useRef<() => void>(() => {});

  const ciclo = useCallback(() => {
    if (prefiereMenosMovimientoRef.current) return;

    setEstado("sentado");
    if (Math.random() < 0.4) decirAlgoAlAzar();

    programar(() => {
      setPosicion((actual) => {
        const nueva = posicionAleatoria();
        setMirandoIzquierda(nueva.x < actual.x);
        return nueva;
      });
      setEstado("caminando");

      programar(() => cicloRef.current(), 2600);
    }, 3000 + Math.random() * 3000);
  }, [programar, decirAlgoAlAzar]);

  useEffect(() => {
    cicloRef.current = ciclo;
  }, [ciclo]);

  useEffect(() => {
    if (!activo) {
      limpiarTimeouts();
      setEstado("sentado");
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

  return (
    <button
      type="button"
      className={`mascota-personaje mascota-${estado}${reaccionando ? " mascota-reaccion" : ""}${
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
        <span className="mascota-marca" />
      </span>

      <span className="mascota-patas" aria-hidden="true">
        <span className="mascota-pata" />
        <span className="mascota-pata" />
      </span>

      {mensaje && <span className="mascota-globo">{mensaje}</span>}
    </button>
  );
}
