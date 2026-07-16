"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthProvider";
import { EMPRESA_VACIA } from "../app/configuracion/types";

export type ModoInterfaz = "easy" | "completo";

interface ModoInterfazContexto {
  // null = todavía no se sabe (cargando) o la cuenta nunca eligió —
  // en ese segundo caso es cuando se debe mostrar la pantalla de
  // bienvenida "¿Cómo quieres usar CoreStock?".
  modoInterfaz: ModoInterfaz | null;
  esEasy: boolean;
  cargando: boolean;
  refrescar: () => Promise<void>;
  cambiarModo: (modo: ModoInterfaz) => Promise<void>;
}

const Contexto = createContext<ModoInterfazContexto>({
  modoInterfaz: null,
  esEasy: false,
  cargando: true,
  refrescar: async () => {},
  cambiarModo: async () => {},
});

export function useModoInterfaz() {
  return useContext(Contexto);
}

export default function ModoInterfazProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, cargando: cargandoAuth } = useAuth();
  const [modoInterfaz, setModoInterfaz] = useState<ModoInterfaz | null>(null);
  const [cargando, setCargando] = useState(true);

  const refrescar = useCallback(async () => {
    // Igual que SuscripcionProvider: no resolvemos nada hasta que
    // AuthProvider termine de verificar la sesión.
    if (cargandoAuth) return;

    if (!user) {
      setModoInterfaz(null);
      setCargando(false);
      return;
    }

    setCargando(true);

    const { data, error } = await supabase
      .from("empresa_config")
      .select("modo_interfaz")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      // Falla transitoria: no forzamos "sin elegir" (mostraría la
      // pantalla de bienvenida de nuevo) por un error de red pasajero.
      console.error(error);
    } else {
      const valor = data?.modo_interfaz;
      setModoInterfaz(valor === "easy" || valor === "completo" ? valor : null);
    }

    setCargando(false);
  }, [user, cargandoAuth]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  async function cambiarModo(modo: ModoInterfaz) {
    if (!user) return;

    // Una cuenta recién registrada puede no tener fila en
    // empresa_config todavía (se crea perezosamente al guardar algo
    // en Configuración > Empresa por primera vez) — justo el caso más
    // común para esta pantalla. Un simple update() no crearía la
    // fila, así que primero se intenta actualizar y, si no afectó
    // ninguna fila, se inserta una con los valores por defecto en vez
    // de arriesgarse a pisar (con un upsert de un solo campo) columnas
    // que si existieran no deberían tocarse.
    const { data: actualizado, error: errorUpdate } = await supabase
      .from("empresa_config")
      .update({ modo_interfaz: modo })
      .eq("user_id", user.id)
      .select("user_id");

    if (errorUpdate) throw errorUpdate;

    if (!actualizado || actualizado.length === 0) {
      const { error: errorInsert } = await supabase
        .from("empresa_config")
        .insert({ ...EMPRESA_VACIA, modo_interfaz: modo, user_id: user.id });

      if (errorInsert) throw errorInsert;
    }

    setModoInterfaz(modo);
  }

  return (
    <Contexto.Provider
      value={{
        modoInterfaz,
        esEasy: modoInterfaz === "easy",
        cargando,
        refrescar,
        cambiarModo,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}
