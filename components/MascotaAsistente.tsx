"use client";

import { useEffect, useRef, useState } from "react";
import { useIdioma } from "./LanguageProvider";

const CLAVES_FRASES = [
  "asistente.mascota.frase1",
  "asistente.mascota.frase2",
  "asistente.mascota.frase3",
  "asistente.mascota.frase4",
  "asistente.mascota.frase5",
  "asistente.mascota.frase6",
];

// Mascota decorativa del Asistente IA: mientras no estás escribiendo,
// camina de un lado al otro de la pantalla; si le tocas, salta y dice
// una frase corta en un globo — puro cariño, no tiene ningún efecto
// sobre la conversación real. `activo` lo decide app/asistente/page.tsx
// (deja de caminar en cuanto la persona empieza a escribir).
export default function MascotaAsistente({ activo }: { activo: boolean }) {
  const { t } = useIdioma();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [saltando, setSaltando] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Si la persona empieza a escribir a mitad del salto, el padre pone
  // activo=false y este componente deja de pintarse — pero sin esto,
  // el setTimeout de alTocar() seguía vivo y, si volvía a quedar
  // inactiva antes de que se cumpliera, la mascota reaparecía "a
  // mitad de salto" con el mensaje viejo en vez de en reposo.
  useEffect(() => {
    if (activo) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMensaje(null);
    setSaltando(false);
  }, [activo]);

  function alTocar() {
    const frase = CLAVES_FRASES[Math.floor(Math.random() * CLAVES_FRASES.length)];
    setMensaje(t(frase));
    setSaltando(true);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setMensaje(null);
      setSaltando(false);
    }, 2600);
  }

  if (!activo) return null;

  return (
    <div className="mascota-contenedor">
      <button
        type="button"
        className={`mascota-personaje${saltando ? " mascota-saltando" : ""}`}
        onClick={alTocar}
        aria-label={t("asistente.mascota.aria")}
      >
        <span className="mascota-cuerpo">
          <span className="mascota-antena" aria-hidden="true" />
          <span className="mascota-ojo mascota-ojo-izq" aria-hidden="true" />
          <span className="mascota-ojo mascota-ojo-der" aria-hidden="true" />
          <span className="mascota-pata mascota-pata-izq" aria-hidden="true" />
          <span className="mascota-pata mascota-pata-der" aria-hidden="true" />
        </span>

        {mensaje && <span className="mascota-globo">{mensaje}</span>}
      </button>
    </div>
  );
}
