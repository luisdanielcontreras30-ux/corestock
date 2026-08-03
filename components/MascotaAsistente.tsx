"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIdioma } from "./LanguageProvider";
import { useTheme } from "./ThemeProvider";
import type { EmocionCorebot } from "../lib/groq";

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

// Gesto = la cara/pose emocional de Corebot, separada de la postura
// (que es solo cómo se sostiene según el tramo del recorrido). Tiene
// tres fuentes, en orden de prioridad:
// 1. "pensando" mientras el Asistente espera la respuesta (lo decide
//    el navegador, es un estado real, no inventado).
// 2. La emoción que trae la última respuesta de la IA (la elige el
//    propio modelo — ver lib/groq.ts — o el motor de reglas con un
//    mapeo simple). Dura unos segundos y luego se apaga sola.
// 3. Una siesta aleatoria ocasional mientras descansa en el piso, solo
//    para que "durmiendo" también se vea sin depender de la charla.
type Gesto = EmocionCorebot | null;

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

// En los temas de referencia (estilo Matrix), Corebot no solo cambia
// de color con var(--primary) — se disfraza del personaje que
// inspira al tema. En el resto de los 33 temas sigue siendo el mismo
// robot, solo con otro color.
type PersonajeEspecial = "demogorgon" | "cyberpunk" | "joker" | null;

function personajeEspecialDeTema(tema: string): PersonajeEspecial {
  if (tema === "strangerthings") return "demogorgon";
  if (tema === "cyberpunk") return "cyberpunk";
  if (tema === "joker") return "joker";
  return null;
}

interface Props {
  activo: boolean;
  // true mientras el Asistente espera la respuesta de la pregunta que
  // se acaba de mandar — Corebot se queda quieta pensando en vez de
  // seguir su recorrido normal.
  pensando?: boolean;
  // La emoción de la última respuesta (de la IA o del motor de
  // reglas). Al llegar una nueva, Corebot reacciona con esa cara Y se
  // mueve de una vez a otro tramo, en vez de esperar a su próximo
  // turno del ciclo — así se siente que de verdad está reaccionando a
  // lo que se acaba de decir.
  emocion?: EmocionCorebot | null;
}

// Corebot, la mascota del Asistente IA: mientras no se está
// escribiendo, recorre los bordes de la pantalla — nunca por encima
// del chat — sentándose o escalando/colgándose según el tramo, y a
// veces suelta un consejo solo. Si se le toca, reacciona con un salto
// y dice una frase o un consejo. `activo` lo decide
// app/asistente/page.tsx (se esconde en cuanto la persona escribe).
export default function MascotaAsistente({ activo, pensando = false, emocion = null }: Props) {
  const { t } = useIdioma();
  const { tema } = useTheme();
  const especial = personajeEspecialDeTema(tema);
  const [zona, setZona] = useState<Zona>("suelo");
  const [posicion, setPosicion] = useState<Posicion>(() => posicionEnZona("suelo"));
  const [mirandoIzquierda, setMirandoIzquierda] = useState(false);
  const [enMovimiento, setEnMovimiento] = useState(false);
  const [reaccionando, setReaccionando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [gestoAmbiente, setGestoAmbiente] = useState<Gesto>(null);

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

  // Avanza al siguiente tramo del perímetro: calcula la posición
  // nueva, decide hacia dónde queda mirando, y arranca a caminar. La
  // usan tanto el ciclo normal (más abajo) como la reacción inmediata
  // cuando llega una emoción nueva de la conversación.
  const avanzarZona = useCallback(() => {
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
    setGestoAmbiente(null);
  }, []);

  // Ciclo de vida: se queda quieta unos segundos (a veces dice algo
  // sin que nadie la toque, y a veces se echa una siesta) -> avanza al
  // siguiente tramo del perímetro -> vuelve a quedarse quieta, y así
  // en bucle. Se llama a sí misma por dentro de un setTimeout, así que
  // se guarda en un ref (en vez de que la función se referencie a sí
  // misma por su propio nombre) para que el linter no la marque como
  // usada antes de declararse.
  const cicloRef = useRef<() => void>(() => {});

  const ciclo = useCallback(() => {
    if (prefiereMenosMovimientoRef.current) return;

    setEnMovimiento(false);
    if (zonaRef.current === "suelo" && Math.random() < 0.25) {
      setGestoAmbiente("durmiendo");
    } else if (Math.random() < 0.4) {
      decirAlgoAlAzar();
    }

    programar(() => {
      avanzarZona();
      programar(() => cicloRef.current(), 2600);
    }, 3000 + Math.random() * 3000);
  }, [programar, decirAlgoAlAzar, avanzarZona]);

  useEffect(() => {
    cicloRef.current = ciclo;
  }, [ciclo]);

  // Un solo efecto gobierna el recorrido: escondida (escribiendo) lo
  // apaga todo; pensando lo congela donde esté (sin seguir
  // caminando); y activa-y-libre reanuda el ciclo normal.
  useEffect(() => {
    if (!activo) {
      limpiarTimeouts();
      setEnMovimiento(false);
      setReaccionando(false);
      setMensaje(null);
      return;
    }

    if (pensando) {
      limpiarTimeouts();
      setEnMovimiento(false);
      return;
    }

    cicloRef.current();
    return limpiarTimeouts;
  }, [activo, pensando, limpiarTimeouts]);

  // Cuando llega una emoción nueva de la conversación (la IA o el
  // motor de reglas acaban de responder), Corebot reacciona: salta, y
  // de una vez camina al siguiente tramo en vez de esperar su turno
  // — así se ve que está reaccionando a lo que se acaba de decir, no
  // solo poniendo otra cara sin moverse.
  useEffect(() => {
    if (!emocion || !activo || pensando || prefiereMenosMovimientoRef.current) return;

    limpiarTimeouts();
    setReaccionando(true);
    programar(() => setReaccionando(false), 700);
    programar(() => {
      avanzarZona();
      programar(() => cicloRef.current(), 2600);
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emocion]);

  function alTocar() {
    setReaccionando(true);
    decirAlgoAlAzar();
    programar(() => setReaccionando(false), 900);
  }

  if (!activo) return null;

  const postura = posturaDeZona(zona, enMovimiento);
  const gesto: Gesto = pensando ? "pensando" : emocion ?? gestoAmbiente;

  return (
    <button
      type="button"
      className={`mascota-personaje mascota-${postura}${reaccionando ? " mascota-reaccion" : ""}${
        mirandoIzquierda ? " mascota-volteada" : ""
      }${especial ? ` mascota-especial-${especial}` : ""}${gesto ? ` mascota-gesto-${gesto}` : ""}`}
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
          <span className="mascota-boca" />
          {gesto === "analizando" && <span className="mascota-escaner" />}
          {especial === "joker" && <span className="mascota-sonrisa-joker" />}
        </span>
        {especial === "demogorgon" && (
          <span className="mascota-petalos" aria-hidden="true">
            <span className="mascota-petalo" />
            <span className="mascota-petalo" />
            <span className="mascota-petalo" />
            <span className="mascota-petalo" />
            <span className="mascota-petalo" />
          </span>
        )}
        {especial === "joker" && (
          <span className="mascota-pelo-joker" aria-hidden="true">
            <span className="mascota-mechon" />
            <span className="mascota-mechon" />
            <span className="mascota-mechon" />
          </span>
        )}
      </span>

      <span className="mascota-cuerpo" aria-hidden="true">
        <span className="mascota-brazo mascota-brazo-izq" />
        <span className="mascota-marca" />
        <span className="mascota-brazo mascota-brazo-der" />
        {especial === "cyberpunk" && (
          <>
            <span className="mascota-chaqueta-cuello mascota-chaqueta-cuello-izq" />
            <span className="mascota-chaqueta-cuello mascota-chaqueta-cuello-der" />
            <span className="mascota-chaqueta-franja" />
          </>
        )}
      </span>

      <span className="mascota-patas" aria-hidden="true">
        <span className="mascota-pata" />
        <span className="mascota-pata" />
      </span>

      {mensaje && <span className="mascota-globo">{mensaje}</span>}
    </button>
  );
}
