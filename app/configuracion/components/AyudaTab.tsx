"use client";

import { useState } from "react";
import Link from "next/link";
import { LifeBuoy, MessageCircle, PlayCircle, Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";
import { supabase } from "../../../lib/supabase";
import {
  ENLACE_SOPORTE_WHATSAPP,
  NUMERO_SOPORTE_VISIBLE,
} from "../../../lib/soporte";

// Lo que responde el diagnóstico de /api/ia/asistente. Texto e imágenes
// van por separado a propósito: son modelos distintos y fallan por
// separado. Reportarlos juntos fue lo que dejó "el chat funciona pero
// las fotos no" sin ninguna explicación.
interface ResultadoModelo {
  motivo: string;
  detalle?: string;
  modelo?: string;
  // true cuando nadie configuró ese modelo y se está usando el que trae
  // la app. Viaja como bandera y no pegado al nombre porque el servidor
  // no sabe en qué idioma está la persona: la etiqueta se traduce aquí.
  porDefecto?: boolean;
  // Quién atiende esa parte: el chat lo hace Groq y las fotos las hace
  // Google cuando su llave está puesta. Sin verlo, un error de Google
  // parecía un problema de Groq y se buscaba dónde no era.
  proveedor?: string;
}

interface EstadoIA {
  configurada: boolean;
  texto?: ResultadoModelo;
  vision?: ResultadoModelo;
  // Los modelos que la cuenta tiene disponibles ahora, consultados a
  // Groq. Solo vienen cuando algo falló, que es cuando sirven.
  modelosDisponibles?: string[];
  // Solo cuando el fallo es del navegador y ni se llegó a preguntar.
  motivo?: string;
  detalle?: string;
}

export default function AyudaTab() {
  const { t } = useIdioma();
  const [probando, setProbando] = useState(false);
  const [estadoIA, setEstadoIA] = useState<EstadoIA | null>(null);

  // El Asistente cae al motor de reglas en silencio cuando la IA falla,
  // así que desde fuera "no está configurada" y "está configurada pero
  // se cayó" se ven igual. Esto las distingue: hace una llamada mínima
  // de verdad y dice qué pasó.
  async function probarIA() {
    if (probando) return;
    setProbando(true);
    setEstadoIA(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setEstadoIA({ configurada: false, motivo: "sin_sesion" });
        return;
      }

      const respuesta = await fetch("/api/ia/asistente", {
        headers: { Authorization: `Bearer ${token}` },
      });

      let cuerpo: unknown = null;
      try {
        cuerpo = await respuesta.json();
      } catch {
        // Un 502 del hosting o una página de error devuelven HTML, no
        // JSON. No es un fallo de red: el servidor contestó.
      }

      // No todo lo que responde esta ruta es un diagnóstico. Un 401 (la
      // sesión caducó entre abrir la pantalla y pulsar el botón) o un
      // error del hosting traen otra forma, y guardarla tal cual dejaba
      // la pantalla EXACTAMENTE igual que antes de pulsar: sin fila, sin
      // error, sin nada. Es el fallo silencioso que este botón existe
      // para eliminar, ocurriendo dentro del propio botón.
      //
      // El 429 sí trae la forma normal (con sus dos filas), así que pasa
      // por aquí sin tratamiento especial.
      const esDiagnostico =
        !!cuerpo && typeof cuerpo === "object" && ("texto" in cuerpo || "motivo" in cuerpo);

      if (!esDiagnostico) {
        setEstadoIA(
          respuesta.status === 401
            ? { configurada: false, motivo: "sin_sesion" }
            : { configurada: false, motivo: "sin_respuesta", detalle: `HTTP ${respuesta.status}` }
        );
        return;
      }

      setEstadoIA(cuerpo as EstadoIA);
    } catch (error) {
      console.error(error);
      setEstadoIA({ configurada: false, motivo: "sin_red" });
    } finally {
      setProbando(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card" style={{ maxWidth: 480 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "rgba(37, 211, 102, 0.12)",
            display: "grid",
            placeItems: "center",
            marginBottom: 12,
          }}
        >
          <LifeBuoy size={26} color="#25d366" />
        </div>
        <h2 style={{ marginBottom: 6 }}>{t("ayuda.titulo")}</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 18, fontSize: 13.5, lineHeight: 1.6 }}>
          {t("ayuda.texto")}
        </p>
        <a
          href={ENLACE_SOPORTE_WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}
        >
          <MessageCircle size={15} /> {t("soporte.boton")}
        </a>

        {/* El botón de arriba abre WhatsApp Web en computadora, que pide
            iniciar sesión aparte — con el número a la vista se puede
            guardar o marcar desde el teléfono sin depender del enlace. */}
        <p style={{ color: "var(--text-secondary)", fontSize: 12.5, margin: "14px 0 0 0" }}>
          {t("ayuda.numero_etiqueta")}{" "}
          <span style={{ color: "var(--text-primary)", fontWeight: 600, whiteSpace: "nowrap" }}>
            {NUMERO_SOPORTE_VISIBLE}
          </span>
        </p>
      </div>

      {/* Diagnóstico de la IA. Va en Ayuda y no en una pantalla de
          desarrollo porque quien instala la app es la misma persona que
          atiende el negocio: si el Asistente "se siente tonto", este es
          el botón que le dice si es la llave, el saldo o el modelo. */}
      <div className="card" style={{ maxWidth: 480 }}>
        <h2 style={{ marginBottom: 6, fontSize: 16 }}>{t("ayuda.ia_titulo")}</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 16, fontSize: 13, lineHeight: 1.6 }}>
          {t("ayuda.ia_texto")}
        </p>

        <button
          className="btn-secondary"
          onClick={probarIA}
          disabled={probando}
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <Sparkles size={15} /> {probando ? t("ayuda.ia_probando") : t("ayuda.ia_boton")}
        </button>

        {estadoIA?.motivo && (
          <Fila etiqueta="" resultado={{ motivo: estadoIA.motivo, detalle: estadoIA.detalle }} t={t} />
        )}

        {estadoIA?.texto && (
          <Fila etiqueta={t("ayuda.ia_parte_texto")} resultado={estadoIA.texto} t={t} />
        )}

        {estadoIA?.vision && (
          <Fila etiqueta={t("ayuda.ia_parte_vision")} resultado={estadoIA.vision} t={t} />
        )}

        {/* Cualquier lista de modelos escrita a mano queda vieja en
            cuanto Groq rota su catálogo. Esta se pide a la cuenta en el
            momento, así que siempre es la de verdad. */}
        {estadoIA?.modelosDisponibles && estadoIA.modelosDisponibles.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: "0 0 8px 0", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
              {t("ayuda.ia_modelos_disponibles")}
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                maxHeight: 180,
                overflowY: "auto",
              }}
            >
              {estadoIA.modelosDisponibles.map((m) => (
                <code
                  key={m}
                  style={{
                    fontSize: 11.5,
                    padding: "4px 8px",
                    borderRadius: 6,
                    background: "var(--card-hover)",
                    color: "var(--text-primary)",
                    overflowWrap: "anywhere",
                  }}
                >
                  {m}
                </code>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Las guías del módulo de Tutoriales resuelven las dudas más
          comunes sin tener que esperar una respuesta de soporte. */}
      <div className="card" style={{ maxWidth: 480 }}>
        <h2 style={{ marginBottom: 6, fontSize: 16 }}>{t("ayuda.tutoriales_titulo")}</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 16, fontSize: 13 }}>
          {t("ayuda.tutoriales_texto")}
        </p>
        <Link
          href="/tutoriales"
          className="btn-secondary"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}
        >
          <PlayCircle size={15} /> {t("ayuda.tutoriales_boton")}
        </Link>
      </div>
    </div>
  );
}

// Una parte del diagnóstico (texto o imágenes). Vive aparte porque se
// dibuja igual dos veces y la diferencia es solo qué modelo se probó.
function Fila({
  etiqueta,
  resultado,
  t,
}: {
  etiqueta: string;
  resultado: ResultadoModelo;
  t: (clave: string) => string;
}) {
  const bien = resultado.motivo === "ok";

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        marginTop: 12,
        padding: "12px 14px",
        borderRadius: 10,
        background: bien ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.12)",
        border: `1px solid ${bien ? "rgba(16, 185, 129, 0.35)" : "rgba(245, 158, 11, 0.35)"}`,
      }}
    >
      {bien ? (
        <CheckCircle2 size={17} color="#10b981" style={{ flexShrink: 0, marginTop: 1 }} />
      ) : (
        <XCircle size={17} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
      )}

      <div style={{ minWidth: 0 }}>
        {etiqueta && (
          <p style={{ margin: "0 0 3px 0", fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
            {etiqueta}
          </p>
        )}

        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--text-primary)" }}>
          {t(`ayuda.ia_estado_${resultado.motivo}`)}
        </p>

        {/* El texto crudo del proveedor ("model not found", "rate limit
            exceeded") no se traduce a propósito: es lo que hay que
            buscar en la documentación o pegarle a soporte tal cual. */}
        {resultado.detalle && !bien && (
          <p
            style={{
              margin: "8px 0 0 0",
              fontSize: 11.5,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              color: "var(--text-secondary)",
              overflowWrap: "anywhere",
            }}
          >
            {resultado.detalle}
          </p>
        )}

        {resultado.proveedor && (
          <p style={{ margin: "8px 0 0 0", fontSize: 11.5, color: "var(--text-secondary)" }}>
            {t("ayuda.ia_proveedor")} {resultado.proveedor}
          </p>
        )}

        {resultado.modelo && (
          <p style={{ margin: "4px 0 0 0", fontSize: 11.5, color: "var(--text-secondary)" }}>
            {t("ayuda.ia_modelo")} {resultado.modelo}
            {/* Saber que el modelo NO lo eligió nadie es media respuesta
                cuando algo falla: dice que la variable de entorno está
                sin poner, no mal puesta. */}
            {resultado.porDefecto && ` ${t("ayuda.ia_modelo_por_defecto")}`}
          </p>
        )}
      </div>
    </div>
  );
}
