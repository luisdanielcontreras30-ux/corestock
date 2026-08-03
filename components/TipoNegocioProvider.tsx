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
import { recomendarModulosConIA } from "../lib/iaAcciones";
import { sembrarEjemplosTipoNegocio } from "../lib/datosNegocioSemilla";

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
  // Elección de tipo de negocio (pantalla de bienvenida O Configuración
  // > Personalización, ambas usan esta misma función): guarda el tipo
  // Y le pide a la IA qué módulos conviene activar para ese negocio
  // (descripcion es el nombre del tipo elegido, o el texto libre para
  // "otro") — si la IA no está disponible o no da una respuesta útil,
  // se cae a la recomendación fija de RUTAS_RECOMENDADAS.
  elegirTipoNegocio: (tipo: TipoNegocio, descripcion: string, idioma: string) => Promise<void>;
  actualizarRutasActivas: (rutas: string[]) => Promise<void>;
}

const Contexto = createContext<TipoNegocioContexto>({
  tipoNegocio: null,
  rutasActivas: null,
  cargando: true,
  refrescar: async () => {},
  elegirTipoNegocio: async () => {},
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

  async function elegirTipoNegocio(tipo: TipoNegocio, descripcion: string, idioma: string) {
    // La IA elige de la lista real de módulos (ver
    // /api/ia/recomendar-modulos) — si no está disponible, no responde
    // nada usable, o falla, se cae a la lista fija de
    // RUTAS_RECOMENDADAS en vez de dejar el menú a medias.
    const hrefsIA = await recomendarModulosConIA(descripcion, idioma);
    const rutas = hrefsIA.length > 0 ? hrefsIA : RUTAS_RECOMENDADAS[tipo] ?? null;

    // rutas se manda explícito (incluso null) — cambiar de tipo de
    // negocio SIEMPRE resiembra rutas_activas, nunca deja la
    // recomendación del tipo anterior a medias.
    await guardar({ tipo_negocio: tipo, rutas_activas: rutas });
    setTipoNegocio(tipo);
    setRutasActivas(rutas);

    // Mejor esfuerzo: agrega productos/servicios de ejemplo del tipo
    // elegido para que el módulo no se sienta vacío — nunca pisa datos
    // reales (ver lib/datosNegocioSemilla.ts) y un fallo aquí no debe
    // tirar la elección del tipo de negocio, que ya se guardó arriba.
    if (user) {
      try {
        const negocioId = await obtenerNegocioId(user.id);
        await sembrarEjemplosTipoNegocio(negocioId, tipo);
      } catch (error) {
        console.error("No se pudieron sembrar los ejemplos del tipo de negocio:", error);
      }
    }
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
        actualizarRutasActivas,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}
