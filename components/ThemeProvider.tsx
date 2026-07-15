"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export type Tema = "dark" | "green" | "blue" | "purple" | "amber" | "slate" | "cyan" | "wine" | "light" | "pink" | "mint" | "sunset";

// Tipo de gráfica para la tendencia de ventas (área/línea/barras) y
// para la distribución de artículos (pastel/barras) — se pueden
// personalizar desde Configuración > Apariencia y afectan a las
// gráficas del dashboard.
export type TipoGraficaTendencia = "area" | "linea" | "barras";
export type TipoGraficaDistribucion = "pastel" | "barras";

interface TemaContexto {
  tema: Tema;
  cambiarTema: (t: Tema) => void;
  tipoTendencia: TipoGraficaTendencia;
  cambiarTipoTendencia: (t: TipoGraficaTendencia) => void;
  tipoDistribucion: TipoGraficaDistribucion;
  cambiarTipoDistribucion: (t: TipoGraficaDistribucion) => void;
}

const Contexto = createContext<TemaContexto>({
  tema: "light",
  cambiarTema: () => {},
  tipoTendencia: "area",
  cambiarTipoTendencia: () => {},
  tipoDistribucion: "pastel",
  cambiarTipoDistribucion: () => {},
});

export function useTheme() {
  return useContext(Contexto);
}

const CLAVE_STORAGE = "corestock-theme";
const CLAVE_STORAGE_TENDENCIA = "corestock-grafica-tendencia";
const CLAVE_STORAGE_DISTRIBUCION = "corestock-grafica-distribucion";

const TEMAS_VALIDOS: Tema[] = ["dark", "green", "blue", "purple", "amber", "slate", "cyan", "wine", "light", "pink", "mint", "sunset"];
const TENDENCIAS_VALIDAS: TipoGraficaTendencia[] = ["area", "linea", "barras"];
const DISTRIBUCIONES_VALIDAS: TipoGraficaDistribucion[] = ["pastel", "barras"];

export default function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [tema, setTema] = useState<Tema>("light");
  const [tipoTendencia, setTipoTendencia] = useState<TipoGraficaTendencia>("area");
  const [tipoDistribucion, setTipoDistribucion] = useState<TipoGraficaDistribucion>("pastel");

  useEffect(() => {
    const guardado = window.localStorage.getItem(CLAVE_STORAGE) as Tema | null;
    const inicial: Tema = guardado && TEMAS_VALIDOS.includes(guardado) ? guardado : "light";
    setTema(inicial);
    document.documentElement.setAttribute("data-theme", inicial);

    const tendenciaGuardada = window.localStorage.getItem(CLAVE_STORAGE_TENDENCIA) as TipoGraficaTendencia | null;
    if (tendenciaGuardada && TENDENCIAS_VALIDAS.includes(tendenciaGuardada)) {
      setTipoTendencia(tendenciaGuardada);
    }

    const distribucionGuardada = window.localStorage.getItem(CLAVE_STORAGE_DISTRIBUCION) as TipoGraficaDistribucion | null;
    if (distribucionGuardada && DISTRIBUCIONES_VALIDAS.includes(distribucionGuardada)) {
      setTipoDistribucion(distribucionGuardada);
    }
  }, []);

  function cambiarTema(nuevoTema: Tema) {
    setTema(nuevoTema);
    document.documentElement.setAttribute("data-theme", nuevoTema);
    window.localStorage.setItem(CLAVE_STORAGE, nuevoTema);
  }

  function cambiarTipoTendencia(nuevoTipo: TipoGraficaTendencia) {
    setTipoTendencia(nuevoTipo);
    window.localStorage.setItem(CLAVE_STORAGE_TENDENCIA, nuevoTipo);
  }

  function cambiarTipoDistribucion(nuevoTipo: TipoGraficaDistribucion) {
    setTipoDistribucion(nuevoTipo);
    window.localStorage.setItem(CLAVE_STORAGE_DISTRIBUCION, nuevoTipo);
  }

  return (
    <Contexto.Provider
      value={{
        tema,
        cambiarTema,
        tipoTendencia,
        cambiarTipoTendencia,
        tipoDistribucion,
        cambiarTipoDistribucion,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}
