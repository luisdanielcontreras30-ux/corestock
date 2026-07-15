"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { Miembro, Permiso } from "../app/configuracion/types";

const CLAVE_STORAGE = "corestock_miembro_activo";

interface DatosGuardados {
  userId: string;
  miembro: Miembro;
}

interface MiembroActivoContexto {
  // null = sesión sin restricciones (el dueño de la cuenta).
  miembroActivo: Miembro | null;
  establecerMiembroActivo: (miembro: Miembro, userId: string) => void;
  limpiarMiembroActivo: () => void;
  puede: (permiso: Permiso) => boolean;
}

const Contexto = createContext<MiembroActivoContexto>({
  miembroActivo: null,
  establecerMiembroActivo: () => {},
  limpiarMiembroActivo: () => {},
  puede: () => true,
});

export function useMiembroActivo() {
  return useContext(Contexto);
}

// Guarda qué "miembro del equipo" está actuando en la sesión actual
// (ver login: el dueño de la cuenta entra sin elegir nombre y no
// tiene restricciones; un miembro del equipo elige su nombre al
// entrar y queda limitado a sus permisos). Se persiste en
// sessionStorage — dura mientras la pestaña esté abierta, pero no
// sobrevive a cerrar sesión ni a cambiar de cuenta.
export default function MiembroActivoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [miembroActivo, setMiembroActivo] = useState<Miembro | null>(null);

  useEffect(() => {
    if (!user) {
      setMiembroActivo(null);
      return;
    }

    try {
      const guardado = sessionStorage.getItem(CLAVE_STORAGE);
      if (!guardado) return;

      const datos = JSON.parse(guardado) as DatosGuardados;
      if (datos.userId === user.id) {
        setMiembroActivo(datos.miembro);
      } else {
        // Corresponde a otra cuenta (navegador compartido) — se descarta.
        sessionStorage.removeItem(CLAVE_STORAGE);
      }
    } catch {
      sessionStorage.removeItem(CLAVE_STORAGE);
    }
  }, [user]);

  function establecerMiembroActivo(miembro: Miembro, userId: string) {
    setMiembroActivo(miembro);
    try {
      sessionStorage.setItem(CLAVE_STORAGE, JSON.stringify({ userId, miembro }));
    } catch {
      // Si sessionStorage no está disponible, el identificador de
      // miembro solo vive en memoria durante esta sesión de React.
    }
  }

  function limpiarMiembroActivo() {
    setMiembroActivo(null);
    try {
      sessionStorage.removeItem(CLAVE_STORAGE);
    } catch {
      // ver comentario arriba
    }
  }

  function puede(permiso: Permiso): boolean {
    if (!miembroActivo) return true;
    return miembroActivo.permisos.includes(permiso);
  }

  return (
    <Contexto.Provider value={{ miembroActivo, establecerMiembroActivo, limpiarMiembroActivo, puede }}>
      {children}
    </Contexto.Provider>
  );
}
