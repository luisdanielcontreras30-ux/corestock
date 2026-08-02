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
import { TipoNegocio, RUTAS_RECOMENDADAS } from "../lib/tiposNegocio";

interface TipoNegocioContexto {
  // null = todavía no se sabe (cargando) o la cuenta nunca eligió — en
  // ese segundo caso es cuando se debe mostrar la pantalla "¿Qué tipo
  // de negocio tienes?", antes de la de modo_interfaz.
  tipoNegocio: TipoNegocio | null;
  // null = sin personalizar, se muestra el menú completo. Ver
  // supabase_personalizacion_negocio.sql.
  rutasActivas: string[] | null;
  cargando: boolean;
  refrescar: () => Promise<void>;
  // Elección inicial (pantalla de bienvenida): guarda el tipo Y siembra
  // rutas_activas con su recomendación de una sola vez.
  elegirTipoNegocio: (tipo: TipoNegocio) => Promise<void>;
  // Edición manual desde Configuración > Personalización: cambia solo
  // lo que se le pide, sin tocar lo otro (cambiar el tipo de negocio
  // ahí NO resiembra rutas_activas, para no borrar personalizaciones
  // que la persona ya hizo a mano).
  actualizarTipoNegocio: (tipo: TipoNegocio) => Promise<void>;
  actualizarRutasActivas: (rutas: string[]) => Promise<void>;
}

const Contexto = createContext<TipoNegocioContexto>({
  tipoNegocio: null,
  rutasActivas: null,
  cargando: true,
  refrescar: async () => {},
  elegirTipoNegocio: async () => {},
  actualizarTipoNegocio: async () => {},
  actualizarRutasActivas: async () => {},
});

export function useTipoNegocio() {
  return useContext(Contexto);
}

// Mismo tratamiento que ModoInterfazProvider: si
// supabase_personalizacion_negocio.sql todavía no corrió en el
// proyecto de Supabase del usuario, no se debe atrapar a nadie sin
// poder entrar a la app solo por eso.
function esColumnaFaltante(error: unknown): boolean {
  const codigo = (error as { code?: string } | null)?.code;
  const mensaje = (error as { message?: string } | null)?.message ?? "";
  return (
    codigo === "42703" ||
    codigo === "PGRST204" ||
    mensaje.toLowerCase().includes("tipo_negocio") ||
    mensaje.toLowerCase().includes("rutas_activas")
  );
}

export default function TipoNegocioProvider({ children }: { children: ReactNode }) {
  const { user, cargando: cargandoAuth } = useAuth();
  const [tipoNegocio, setTipoNegocio] = useState<TipoNegocio | null>(null);
  const [rutasActivas, setRutasActivas] = useState<string[] | null>(null);
  const [cargando, setCargando] = useState(true);

  const refrescar = useCallback(async () => {
    if (cargandoAuth) return;

    if (!user) {
      setTipoNegocio(null);
      setRutasActivas(null);
      setCargando(false);
      return;
    }

    setCargando(true);

    const { data, error } = await supabase
      .from("empresa_config")
      .select("tipo_negocio, rutas_activas")
      .maybeSingle();

    if (error) {
      if (esColumnaFaltante(error)) {
        console.warn(
          "empresa_config.tipo_negocio/rutas_activas todavía no existen — corre supabase_personalizacion_negocio.sql para que la elección se recuerde entre sesiones.",
          error
        );
      } else {
        console.error(error);
      }
    } else {
      const tipo = data?.tipo_negocio as TipoNegocio | null | undefined;
      setTipoNegocio(tipo ?? null);
      setRutasActivas((data?.rutas_activas as string[] | null) ?? null);
    }

    setCargando(false);
  }, [user, cargandoAuth]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  async function guardar(cambios: { tipo_negocio?: TipoNegocio; rutas_activas?: string[] | null }) {
    if (!user) return;

    const negocioId = await obtenerNegocioId(user.id);

    // Igual que cambiarModo() en ModoInterfazProvider: una cuenta
    // recién registrada puede no tener fila en empresa_config todavía
    // (se crea perezosamente al guardar algo en Configuración > Empresa
    // por primera vez), así que primero se intenta actualizar y, si no
    // afectó ninguna fila, se inserta una con los valores por defecto.
    const { data: actualizado, error: errorUpdate } = await supabase
      .from("empresa_config")
      .update(cambios)
      .eq("user_id", negocioId)
      .select("user_id");

    if (errorUpdate && esColumnaFaltante(errorUpdate)) {
      console.warn(
        "empresa_config.tipo_negocio/rutas_activas todavía no existen — corre supabase_personalizacion_negocio.sql. La elección se aplica solo en esta sesión mientras tanto.",
        errorUpdate
      );
      return;
    }

    if (errorUpdate) throw errorUpdate;

    if (!actualizado || actualizado.length === 0) {
      const { error: errorInsert } = await supabase
        .from("empresa_config")
        .insert({ ...EMPRESA_VACIA, ...cambios, user_id: negocioId });

      if (errorInsert && esColumnaFaltante(errorInsert)) {
        console.warn(
          "empresa_config.tipo_negocio/rutas_activas todavía no existen — corre supabase_personalizacion_negocio.sql. La elección se aplica solo en esta sesión mientras tanto.",
          errorInsert
        );
        return;
      }

      if (errorInsert) throw errorInsert;
    }
  }

  async function elegirTipoNegocio(tipo: TipoNegocio) {
    const rutas = RUTAS_RECOMENDADAS[tipo] ?? null;
    await guardar({ tipo_negocio: tipo, rutas_activas: rutas ?? undefined });
    setTipoNegocio(tipo);
    if (rutas) setRutasActivas(rutas);
  }

  async function actualizarTipoNegocio(tipo: TipoNegocio) {
    await guardar({ tipo_negocio: tipo });
    setTipoNegocio(tipo);
  }

  async function actualizarRutasActivas(rutas: string[]) {
    await guardar({ rutas_activas: rutas });
    setRutasActivas(rutas);
  }

  return (
    <Contexto.Provider
      value={{
        tipoNegocio,
        rutasActivas,
        cargando,
        refrescar,
        elegirTipoNegocio,
        actualizarTipoNegocio,
        actualizarRutasActivas,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}
