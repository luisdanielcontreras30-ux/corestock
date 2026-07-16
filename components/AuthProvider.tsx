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
    // getSession() lee la sesión guardada localmente (localStorage),
    // sin red — a diferencia de getUser(), que siempre hace una
    // petición al servidor de Auth para revalidar. Con getUser() aquí,
    // abrir la app sin conexión (recarga en frío) hacía que CUALQUIER
    // falla de red se tratara como "sin sesión" y mandara a /login,
    // dejando inalcanzable todo lo que se guardó para operar offline.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setUser(data.session?.user ?? null);
      })
      .catch((error) => {
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
