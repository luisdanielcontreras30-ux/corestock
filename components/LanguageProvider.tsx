"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Idioma, IDIOMAS_DISPONIBLES, traducir } from "../lib/i18n";

interface IdiomaContexto {
  idioma: Idioma;
  cambiarIdioma: (i: Idioma) => void;
  t: (clave: string) => string;
}

const Contexto = createContext<IdiomaContexto>({
  idioma: "es",
  cambiarIdioma: () => {},
  t: (clave: string) => clave,
});

export function useIdioma() {
  return useContext(Contexto);
}

const CLAVE_STORAGE = "corestock-idioma";

export default function LanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [idioma, setIdioma] = useState<Idioma>("es");

  useEffect(() => {
    const guardado = window.localStorage.getItem(
      CLAVE_STORAGE
    ) as Idioma | null;

    // Se deriva de IDIOMAS_DISPONIBLES (no una lista aparte a mano) para
    // que un idioma nuevo agregado ahí no se quede fuera de esta
    // lista de restauración — eso es justo lo que pasó con "it": se
    // podía elegir en el selector, pero al recargar la página (o abrir
    // una pestaña nueva) el idioma guardado no pasaba este chequeo y
    // se perdía silenciosamente, volviendo siempre a español.
    if (IDIOMAS_DISPONIBLES.some((i) => i.valor === guardado)) {
      setIdioma(guardado as Idioma);
    }
  }, []);

  function cambiarIdioma(nuevoIdioma: Idioma) {
    setIdioma(nuevoIdioma);
    window.localStorage.setItem(CLAVE_STORAGE, nuevoIdioma);
  }

  function t(clave: string): string {
    return traducir(clave, idioma);
  }

  return (
    <Contexto.Provider value={{ idioma, cambiarIdioma, t }}>
      {children}
    </Contexto.Provider>
  );
}
