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
import { Plan } from "../lib/suscripcion";

interface SuscripcionContexto {
  plan: Plan;
  esPlus: boolean;
  cargando: boolean;
  refrescar: () => Promise<void>;
}

const Contexto = createContext<SuscripcionContexto>({
  plan: "free",
  esPlus: false,
  cargando: true,
  refrescar: async () => {},
});

export function useSuscripcion() {
  return useContext(Contexto);
}

export default function SuscripcionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, cargando: cargandoAuth } = useAuth();
  const [plan, setPlan] = useState<Plan>("free");
  const [cargando, setCargando] = useState(true);

  const refrescar = useCallback(async () => {
    // Todavía no sabemos si hay sesión o no — no resolvemos nada
    // (ni "free" ni "plus") hasta que AuthProvider termine de verificar,
    // para no marcar "cargando: false" con un plan por defecto antes de
    // tiempo.
    if (cargandoAuth) return;

    if (!user) {
      setPlan("free");
      setCargando(false);
      return;
    }

    setCargando(true);

    const { data, error } = await supabase
      .from("empresa_config")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data?.plan === "plus") {
      setPlan("plus");
    } else {
      setPlan("free");
    }

    setCargando(false);
  }, [user, cargandoAuth]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  return (
    <Contexto.Provider
      value={{ plan, esPlus: plan === "plus", cargando, refrescar }}
    >
      {children}
    </Contexto.Provider>
  );
}
