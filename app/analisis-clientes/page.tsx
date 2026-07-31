"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserSearch, MessageCircle, Sparkles, RefreshCcw } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import RequierePlus from "../../components/RequierePlus";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import IaNoDisponible from "../../components/IaNoDisponible";
import CargandoLista from "../../components/CargandoLista";
import { IA_DISPONIBLE } from "../../lib/soporte";
import { mensajeErrorSeguro } from "../../lib/errores";
import { enlaceWhatsApp } from "../../lib/whatsapp";
import { analizarClientesFrecuentes } from "./acciones";
import { SugerenciaCliente } from "./types";

export default function AnalisisClientesPage() {
  return (
    <RequierePlus>
      <AnalisisClientesContenido />
    </RequierePlus>
  );
}

function AnalisisClientesContenido() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t, idioma } = useIdioma();
  const { mostrarToast } = useToast();

  const [analizando, setAnalizando] = useState(false);
  const [yaAnalizo, setYaAnalizo] = useState(false);
  const [sugerencias, setSugerencias] = useState<SugerenciaCliente[]>([]);
  // Se edita antes de enviar: la IA propone, pero el texto final que sale
  // por WhatsApp lo decide quien lo manda. Se indexa por clienteId porque
  // el orden de la lista no cambia entre análisis.
  const [mensajesEditados, setMensajesEditados] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    if (cargandoAuth) return;
    if (!user) {
      router.push("/login");
    }
  }, [cargandoAuth, user, router]);

  if (cargandoAuth || !user) {
    return (
      <main className="fade-up">
        <CargandoLista />
      </main>
    );
  }

  async function analizar() {
    if (analizando) return;

    setAnalizando(true);
    try {
      const resultado = await analizarClientesFrecuentes(idioma);
      setSugerencias(resultado);
      setMensajesEditados(new Map(resultado.map((s) => [s.clienteId, s.mensaje])));
      setYaAnalizo(true);
    } catch (error) {
      console.error(error);
      mostrarToast(mensajeErrorSeguro(error) || t("analisis_clientes.msg_error"), "error");
    } finally {
      setAnalizando(false);
    }
  }

  function abrirWhatsApp(sugerencia: SugerenciaCliente) {
    const texto = mensajesEditados.get(sugerencia.clienteId) ?? sugerencia.mensaje;
    window.open(enlaceWhatsApp(texto, sugerencia.telefono), "_blank");
  }

  return (
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <EncabezadoModulo
        Icono={UserSearch}
        color="#e879f9"
        titulo={t("analisis_clientes.titulo")}
        subtitulo={t("analisis_clientes.subtitulo")}
      />

      {!IA_DISPONIBLE ? (
        <IaNoDisponible />
      ) : (
        <>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ color: "var(--text-secondary)", fontSize: 13.5, margin: 0 }}>
              {t("analisis_clientes.explicacion")}
            </p>
            <button
              className="btn-primary"
              onClick={analizar}
              disabled={analizando}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start" }}
            >
              {yaAnalizo ? <RefreshCcw size={16} /> : <Sparkles size={16} />}
              {analizando
                ? t("analisis_clientes.analizando")
                : yaAnalizo
                ? t("analisis_clientes.analizar_de_nuevo")
                : t("analisis_clientes.analizar")}
            </button>
          </div>

          {analizando ? (
            <CargandoLista />
          ) : yaAnalizo && sugerencias.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "50px 20px" }}>
              <p style={{ color: "var(--text-secondary)" }}>{t("analisis_clientes.sin_candidatos")}</p>
            </div>
          ) : sugerencias.length > 0 ? (
            <div className="analisis-clientes-rejilla">
              {sugerencias.map((s) => (
                <div key={s.clienteId} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px 0" }}>{s.nombre}</h3>
                    <span style={{ color: "var(--text-secondary)", fontSize: 12.5 }}>
                      {t("analisis_clientes.compras_y_producto")
                        .replace("{compras}", String(s.compras))
                        .replace("{producto}", s.productoTop ?? t("analisis_clientes.sin_producto_favorito"))}
                    </span>
                  </div>

                  <textarea
                    value={mensajesEditados.get(s.clienteId) ?? s.mensaje}
                    onChange={(e) =>
                      setMensajesEditados((mapa) => new Map(mapa).set(s.clienteId, e.target.value))
                    }
                    rows={3}
                    style={{ resize: "vertical" }}
                  />

                  <button
                    className="btn-secondary"
                    onClick={() => abrirWhatsApp(s)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}
                  >
                    <MessageCircle size={15} /> {t("analisis_clientes.abrir_whatsapp")}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
