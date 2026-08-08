"use client";

import { useEffect, useRef, ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { sembrarDatosDemoSiAplica } from "../lib/sembrarDemo";

// Solo hace algo si el usuario logueado es la cuenta demo (ver
// lib/sembrarDemo.ts) — para cualquier otra cuenta esto no llama a
// Supabase en absoluto.
export default function DemoSeedProvider({ children }: { children: ReactNode }) {
  const { user, cargando } = useAuth();
  const yaIntentado = useRef(false);

  useEffect(() => {
    if (cargando || !user || yaIntentado.current) return;
    yaIntentado.current = true;

    sembrarDatosDemoSiAplica(user.id, user.email).catch((error) => {
      console.error("No se pudo preparar la cuenta demo:", error);
    });
  }, [cargando, user]);

  return <>{children}</>;
}
