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

    // Mantiene el usuario sincronizado si la sesión cambia (por
    // ejemplo, si se cierra sesión en otra pestaña). Solo se limpia el
    // usuario ante un "SIGNED_OUT" explícito — el intento automático
    // de renovar el token (cada ~1 hora) puede fallar simplemente por
    // no tener Internet en ese momento, y algunas versiones del SDK
    // emiten ese fallo como una sesión nula sin ser un cierre de
    // sesión real. Tratar eso como "sin sesión" rompía por completo la
    // premisa de operar offline: de la nada, en medio de usar la app
    // sin conexión, se perdía el usuario y la app expulsaba a la
    // pantalla de elección de modo o dejaba de cargar productos.
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          setUser(null);
          return;
        }

        if (session?.user) {
          setUser(session.user);
        }
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
