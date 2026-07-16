"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "./AuthProvider";
import { sincronizarPendientes, contarPendientes, contarConError } from "../lib/sync";

export type EstadoSync = "sin_conexion" | "sincronizando" | "conectado" | "todo_sincronizado";

interface SyncContexto {
  estado: EstadoSync;
  pendientes: number;
  conError: number;
  sincronizarAhora: () => Promise<void>;
}

const Contexto = createContext<SyncContexto>({
  estado: "conectado",
  pendientes: 0,
  conError: 0,
  sincronizarAhora: async () => {},
});

export function useSync() {
  return useContext(Contexto);
}

const INTERVALO_REINTENTO_MS = 60000;

export default function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [online, setOnline] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [conError, setConError] = useState(0);

  const refrescarContadores = useCallback(async () => {
    if (!user) {
      setPendientes(0);
      setConError(0);
      return;
    }

    const [p, e] = await Promise.all([contarPendientes(user.id), contarConError(user.id)]);
    setPendientes(p);
    setConError(e);
  }, [user]);

  const sincronizarAhora = useCallback(async () => {
    if (!user || typeof navigator === "undefined" || !navigator.onLine || sincronizando) return;

    setSincronizando(true);
    try {
      await sincronizarPendientes(user.id);
    } catch (error) {
      console.error("Error sincronizando pendientes:", error);
    } finally {
      setSincronizando(false);
      await refrescarContadores();
    }
  }, [user, sincronizando, refrescarContadores]);

  // Detecta conexión/desconexión y dispara una sincronización apenas
  // vuelve Internet — no se espera a que el usuario haga nada.
  useEffect(() => {
    setOnline(navigator.onLine);

    function alConectar() {
      setOnline(true);
      sincronizarAhora();
    }

    function alDesconectar() {
      setOnline(false);
    }

    window.addEventListener("online", alConectar);
    window.addEventListener("offline", alDesconectar);

    return () => {
      window.removeEventListener("online", alConectar);
      window.removeEventListener("offline", alDesconectar);
    };
    // sincronizarAhora se omite a propósito: solo se quiere registrar
    // los listeners una vez, no reinstalarlos cada vez que cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refrescarContadores();
  }, [refrescarContadores]);

  // Red de seguridad: algunos navegadores (sobre todo iOS en segundo
  // plano) no disparan el evento "online" de forma confiable — se
  // reintenta cada minuto si sigue habiendo pendientes, en vez de
  // depender solo del evento.
  useEffect(() => {
    const id = setInterval(() => {
      if (navigator.onLine && pendientes > 0) sincronizarAhora();
    }, INTERVALO_REINTENTO_MS);

    return () => clearInterval(id);
  }, [pendientes, sincronizarAhora]);

  let estado: EstadoSync;
  if (!online) estado = "sin_conexion";
  else if (sincronizando) estado = "sincronizando";
  else if (pendientes > 0) estado = "conectado";
  else estado = "todo_sincronizado";

  return (
    <Contexto.Provider value={{ estado, pendientes, conError, sincronizarAhora }}>
      {children}
    </Contexto.Provider>
  );
}
