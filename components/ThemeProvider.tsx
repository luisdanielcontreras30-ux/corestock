"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export type Tema = "dark" | "green" | "blue" | "purple" | "amber" | "slate" | "cyan" | "wine" | "light" | "pink" | "mint" | "sunset";

interface TemaContexto {
  tema: Tema;
  cambiarTema: (t: Tema) => void;
}

const Contexto = createContext<TemaContexto>({
  tema: "light",
  cambiarTema: () => {},
});

export function useTheme() {
  return useContext(Contexto);
}

const CLAVE_STORAGE = "corestock-theme";

export default function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [tema, setTema] = useState<Tema>("light");

  useEffect(() => {
    const guardado = window.localStorage.getItem(
      CLAVE_STORAGE
    ) as Tema | null;

    const inicial: Tema =
      guardado &&
      ["dark", "green", "blue", "purple", "amber", "slate", "cyan", "wine", "light", "pink", "mint", "sunset"].includes(guardado)
        ? guardado
        : "light";

    setTema(inicial);
    document.documentElement.setAttribute("data-theme", inicial);
  }, []);

  function cambiarTema(nuevoTema: Tema) {
    setTema(nuevoTema);
    document.documentElement.setAttribute("data-theme", nuevoTema);
    window.localStorage.setItem(CLAVE_STORAGE, nuevoTema);
  }

  return (
    <Contexto.Provider value={{ tema, cambiarTema }}>
      {children}
    </Contexto.Provider>
  );
}
