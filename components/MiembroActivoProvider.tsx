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
  // true hasta que se confirma si hay un miembro activo guardado — un
  // componente que restringe rutas según miembroActivo debe esperar a
  // que esto sea false antes de decidir, para no montar brevemente una
  // pantalla prohibida mientras todavía no se sabe si hay restricción.
  cargando: boolean;
  establecerMiembroActivo: (miembro: Miembro, userId: string) => void;
  limpiarMiembroActivo: () => void;
  puede: (permiso: Permiso) => boolean;
}

const Contexto = createContext<MiembroActivoContexto>({
  miembroActivo: null,
  cargando: true,
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
  const { user, cargando: cargandoAuth } = useAuth();
  const [miembroActivo, setMiembroActivo] = useState<Miembro | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Espera a que AuthProvider resuelva el usuario real antes de
    // decidir — si no, un reload en una ruta restringida podría montar
    // esa pantalla durante la ventana en la que "user" todavía es null.
    if (cargandoAuth) return;

    if (!user) {
      setMiembroActivo(null);
      setCargando(false);
      return;
    }

    try {
      const guardado = sessionStorage.getItem(CLAVE_STORAGE);
      if (guardado) {
        const datos = JSON.parse(guardado) as DatosGuardados;
        if (datos.userId === user.id) {
          setMiembroActivo(datos.miembro);
        } else {
          // Corresponde a otra cuenta (navegador compartido) — se descarta.
          sessionStorage.removeItem(CLAVE_STORAGE);
        }
      }
    } catch {
      sessionStorage.removeItem(CLAVE_STORAGE);
    } finally {
      setCargando(false);
    }
  }, [user, cargandoAuth]);

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
    <Contexto.Provider value={{ miembroActivo, cargando, establecerMiembroActivo, limpiarMiembroActivo, puede }}>
      {children}
    </Contexto.Provider>
  );
}
