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
import { obtenerNegocioId } from "../lib/negocioActual";
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

// La migración supabase_modo_interfaz.sql agrega la columna
// modo_interfaz — si todavía no se corrió en el proyecto de Supabase
// del usuario, Postgrest devuelve "column does not exist" (lectura) o
// "could not find column in schema cache" (escritura) en vez de un
// error genérico. Se detecta específicamente para no dejar a alguien
// atrapado para siempre en la pantalla de elección sin poder entrar a
// la app solo porque falta correr un script SQL.
function esColumnaFaltante(error: unknown): boolean {
  const codigo = (error as { code?: string } | null)?.code;
  const mensaje = (error as { message?: string } | null)?.message ?? "";
  return (
    codigo === "42703" ||
    codigo === "PGRST204" ||
    mensaje.toLowerCase().includes("modo_interfaz")
  );
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
      .maybeSingle();

    if (error) {
      if (esColumnaFaltante(error)) {
        // Sin la columna todavía no hay forma de recordar la elección
        // entre cargas de página — se deja en null a propósito (se
        // vuelve a mostrar la pantalla de elección) en vez de fingir
        // un valor; cambiarModo() sí deja usar la app en lo que tanto
        // se corre la migración.
        console.warn(
          "empresa_config.modo_interfaz todavía no existe — corre supabase_modo_interfaz.sql para que la elección se recuerde entre sesiones.",
          error
        );
      } else {
        // Falla transitoria: no forzamos "sin elegir" (mostraría la
        // pantalla de bienvenida de nuevo) por un error de red pasajero.
        console.error(error);
      }
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

    // Tiene que ser el id del NEGOCIO, no el auth.uid() propio de
    // quien llama — para un miembro del equipo son distintos. Sin
    // esto, el update de abajo nunca encontraría la fila del negocio
    // (piensa que hace falta crearla) y el insert de respaldo crearía
    // una fila fantasma de empresa_config pegada al auth.uid() del
    // miembro en vez de tocar la del negocio real.
    const negocioId = await obtenerNegocioId();

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
      .eq("user_id", negocioId)
      .select("user_id");

    if (errorUpdate && esColumnaFaltante(errorUpdate)) {
      // La migración todavía no corrió: no hay forma de guardar la
      // elección, pero tampoco se debe atrapar a nadie en la pantalla
      // de bienvenida para siempre por eso — se aplica solo en esta
      // sesión (se perderá al recargar la página hasta correr el SQL).
      console.warn(
        "empresa_config.modo_interfaz todavía no existe — corre supabase_modo_interfaz.sql. La elección se aplica solo en esta sesión mientras tanto.",
        errorUpdate
      );
      setModoInterfaz(modo);
      return;
    }

    if (errorUpdate) throw errorUpdate;

    if (!actualizado || actualizado.length === 0) {
      const { error: errorInsert } = await supabase
        .from("empresa_config")
        .insert({ ...EMPRESA_VACIA, modo_interfaz: modo, user_id: negocioId });

      if (errorInsert && esColumnaFaltante(errorInsert)) {
        console.warn(
          "empresa_config.modo_interfaz todavía no existe — corre supabase_modo_interfaz.sql. La elección se aplica solo en esta sesión mientras tanto.",
          errorInsert
        );
        setModoInterfaz(modo);
        return;
      }

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
