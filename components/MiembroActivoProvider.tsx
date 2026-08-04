"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { Miembro, Permiso } from "../app/configuracion/types";
import { CLAVE_STORAGE_MIEMBRO_ACTIVO, DatosMiembroGuardado, leerMiembroActivoGuardado } from "../lib/negocioActual";
import { obtenerMiMembresia, obtenerMiMembresiaConNegocio } from "../app/configuracion/acciones";
import { supabase } from "../lib/supabase";
import { tienePermiso } from "../lib/permisos";

// Cada cuánto se revisa si el dueño cambió el rol/permisos/estado de
// este miembro mientras la pestaña sigue abierta (ver el efecto más
// abajo) — no tan seguido como para sumar carga innecesaria, pero lo
// bastante como para que un cambio se note en minutos, no solo al
// volver a iniciar sesión.
const INTERVALO_REFRESCO_MS = 120_000;

interface MiembroActivoContexto {
  // null = sesión sin restricciones (el dueño de la cuenta).
  miembroActivo: Miembro | null;
  // true hasta que se confirma si hay un miembro activo guardado — un
  // componente que restringe rutas según miembroActivo debe esperar a
  // que esto sea false antes de decidir, para no montar brevemente una
  // pantalla prohibida mientras todavía no se sabe si hay restricción.
  cargando: boolean;
  // negocioId: el id del NEGOCIO al que pertenece este miembro (el
  // dueño), distinto de userId (su propio auth.uid()) desde que cada
  // miembro tiene su propia identidad de Supabase — ver lib/negocioActual.ts.
  establecerMiembroActivo: (miembro: Miembro, userId: string, negocioId: string) => void;
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

    let cancelado = false;

    async function resolver() {
      try {
        const guardado = sessionStorage.getItem(CLAVE_STORAGE_MIEMBRO_ACTIVO);
        if (guardado) {
          const datos = JSON.parse(guardado) as DatosMiembroGuardado;
          if (datos.userId === user!.id) {
            setMiembroActivo(datos.miembro);
            setCargando(false);
            return;
          }
          // Corresponde a otra cuenta (navegador compartido) — se descarta.
          sessionStorage.removeItem(CLAVE_STORAGE_MIEMBRO_ACTIVO);
        }
      } catch {
        sessionStorage.removeItem(CLAVE_STORAGE_MIEMBRO_ACTIVO);
      }

      // sessionStorage no tiene nada (pestaña nueva, PWA reabierta,
      // navegador reiniciado...), pero eso NO significa que esta sesión
      // sea la del dueño: la sesión real de Supabase Auth de un miembro
      // sigue viva ahí (persiste en localStorage) aunque sessionStorage
      // se haya perdido. Asumir "sin restricciones" en ese caso dejaba
      // a cualquier miembro con acceso total en cuanto sessionStorage
      // desaparecía — se confirma contra el servidor si este auth.uid()
      // en realidad pertenece a un miembro antes de decidir.
      const resultado = await obtenerMiMembresiaConNegocio();
      if (cancelado) return;

      if (resultado && resultado.negocioId) {
        establecerMiembroActivo(resultado.miembro, user!.id, resultado.negocioId);
      } else if (resultado) {
        // Es un miembro, pero el proyecto de Supabase todavía tiene la
        // versión vieja de mi_membresia() (sin negocio_id) — se aplica
        // la restricción de navegación igual (lo más urgente), pero sin
        // persistir un negocioId roto en sessionStorage. Falta correr
        // de nuevo supabase_refrescar_permisos_miembro.sql para que el
        // resto de las consultas (que sí dependen de negocioId) también
        // queden resueltas correctamente.
        console.warn(
          "mi_membresia() no devolvió negocio_id — corre de nuevo supabase_refrescar_permisos_miembro.sql."
        );
        setMiembroActivo(resultado.miembro);
      } else {
        setMiembroActivo(null);
      }
      setCargando(false);
    }

    resolver();

    return () => {
      cancelado = true;
    };
  }, [user, cargandoAuth]);

  // sessionStorage solo guarda una foto de los permisos tomada al
  // iniciar sesión — sin esto, si el dueño le cambia el rol o los
  // permisos a un miembro que ya tiene la pestaña abierta, esa pestaña
  // sigue funcionando con los permisos viejos indefinidamente (hasta
  // que ese miembro cierra sesión y vuelve a entrar). Se consulta la
  // fila real del miembro (vía RPC — un miembro sin "configuracion" no
  // puede leer miembros_equipo directamente por RLS) al entrar y luego
  // cada INTERVALO_REFRESCO_MS mientras la sesión siga siendo de un
  // miembro. Si el dueño lo desactivó mientras tanto, se cierra la
  // sesión en vez de dejarlo seguir usando la app.
  useEffect(() => {
    if (cargandoAuth || !user) return;

    let cancelado = false;

    async function refrescar() {
      const guardado = leerMiembroActivoGuardado();
      if (!guardado || !user || guardado.userId !== user.id) return;

      const fresco = await obtenerMiMembresia();
      if (cancelado || !fresco) return;

      if (!fresco.activo) {
        try {
          await supabase.auth.signOut();
        } catch (error) {
          console.error(error);
        }
        limpiarMiembroActivo();
        window.location.href = "/login";
        return;
      }

      if (JSON.stringify(fresco) === JSON.stringify(guardado.miembro)) return;

      setMiembroActivo(fresco);
      try {
        const datos: DatosMiembroGuardado = {
          userId: guardado.userId,
          negocioId: guardado.negocioId,
          miembro: fresco,
        };
        sessionStorage.setItem(CLAVE_STORAGE_MIEMBRO_ACTIVO, JSON.stringify(datos));
      } catch {
        // ver comentario en establecerMiembroActivo
      }
    }

    refrescar();
    const intervalo = setInterval(refrescar, INTERVALO_REFRESCO_MS);

    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [user, cargandoAuth]);

  function establecerMiembroActivo(miembro: Miembro, userId: string, negocioId: string) {
    setMiembroActivo(miembro);
    try {
      const datos: DatosMiembroGuardado = { userId, negocioId, miembro };
      sessionStorage.setItem(CLAVE_STORAGE_MIEMBRO_ACTIVO, JSON.stringify(datos));
    } catch {
      // Si sessionStorage no está disponible, el identificador de
      // miembro solo vive en memoria durante esta sesión de React.
    }
  }

  function limpiarMiembroActivo() {
    setMiembroActivo(null);
    try {
      sessionStorage.removeItem(CLAVE_STORAGE_MIEMBRO_ACTIVO);
    } catch {
      // ver comentario arriba
    }
  }

  function puede(permiso: Permiso): boolean {
    return tienePermiso(miembroActivo, permiso);
  }

  return (
    <Contexto.Provider value={{ miembroActivo, cargando, establecerMiembroActivo, limpiarMiembroActivo, puede }}>
      {children}
    </Contexto.Provider>
  );
}
