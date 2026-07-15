"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthContexto {
  user: User | null;
  cargando: boolean;
}

const Contexto = createContext<AuthContexto>({
  user: null,
  cargando: true,
});

export function useAuth() {
  return useContext(Contexto);
}

export default function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => {
        setUser(data.user ?? null);
      })
      .catch((error) => {
        // Falla de red al verificar la sesión: no dejamos la app
        // colgada en el spinner de carga para siempre — se trata como
        // "sin sesión" y cada página protegida redirige a /login.
        console.error(error);
        setUser(null);
      })
      .finally(() => {
        setCargando(false);
      });

    // Mantiene el usuario sincronizado si la sesión cambia
    // (por ejemplo, si se cierra sesión en otra pestaña).
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <Contexto.Provider value={{ user, cargando }}>
      {children}
    </Contexto.Provider>
  );
}
