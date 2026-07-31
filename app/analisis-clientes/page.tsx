"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserSearch,
  MessageCircle,
  Sparkles,
  RefreshCcw,
  Wallet,
  Receipt,
  Clock,
  TrendingUp,
  Users,
} from "lucide-react";
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
import { formatoMoneda } from "../ventas/utils";
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

  // Cifras de la tira superior. Todas ya vienen calculadas por cliente
  // desde la API — aquí solo se suman.
  const resumen = useMemo(() => {
    const gastoHistorico = sugerencias.reduce((s, c) => s + c.totalGastado, 0);
    const conPrediccion = sugerencias.filter((c) => c.prediccionMensual !== null);
    const prediccionTotal =
      conPrediccion.length > 0 ? conPrediccion.reduce((s, c) => s + (c.prediccionMensual ?? 0), 0) : null;
    return { gastoHistorico, prediccionTotal };
  }, [sugerencias]);

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
            <>
              <div className="modulo-resumen">
                <div className="modulo-resumen-item">
                  <span className="modulo-resumen-icono">
                    <Users size={17} />
                  </span>
                  <div>
                    <span className="modulo-resumen-valor">{sugerencias.length}</span>
                    <span className="modulo-resumen-etiqueta">{t("analisis_clientes.resumen_clientes")}</span>
                  </div>
                </div>
                <div className="modulo-resumen-item">
                  <span className="modulo-resumen-icono">
                    <Wallet size={17} />
                  </span>
                  <div>
                    <span className="modulo-resumen-valor">{formatoMoneda(resumen.gastoHistorico)}</span>
                    <span className="modulo-resumen-etiqueta">{t("analisis_clientes.resumen_gasto")}</span>
                  </div>
                </div>
                {resumen.prediccionTotal !== null && (
                  <div className="modulo-resumen-item">
                    <span className="modulo-resumen-icono">
                      <TrendingUp size={17} />
                    </span>
                    <div>
                      <span className="modulo-resumen-valor">{formatoMoneda(resumen.prediccionTotal)}</span>
                      <span className="modulo-resumen-etiqueta">{t("analisis_clientes.resumen_prediccion")}</span>
                    </div>
                  </div>
                )}
              </div>

              <p className="analisis-clientes-disclaimer">{t("analisis_clientes.disclaimer_prediccion")}</p>

              <div className="analisis-clientes-rejilla">
                {sugerencias.map((s) => (
                  <div key={s.clienteId} className="analisis-clientes-tarjeta">
                    <div className="analisis-clientes-cabecera">
                      <span className="analisis-clientes-avatar">{s.nombre.trim().charAt(0).toUpperCase() || "?"}</span>
                      <div className="analisis-clientes-identidad">
                        <h3 className="analisis-clientes-nombre">{s.nombre}</h3>
                        <span className="analisis-clientes-producto">
                          {t("analisis_clientes.suele_comprar").replace(
                            "{producto}",
                            s.productoTop ?? t("analisis_clientes.sin_producto_favorito")
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="analisis-clientes-metricas">
                      <div>
                        <Wallet size={14} />
                        <span className="analisis-clientes-metrica-valor">{formatoMoneda(s.totalGastado)}</span>
                        <span className="analisis-clientes-metrica-etiqueta">{t("analisis_clientes.gastado_total")}</span>
                      </div>
                      <div>
                        <Receipt size={14} />
                        <span className="analisis-clientes-metrica-valor">{s.compras}</span>
                        <span className="analisis-clientes-metrica-etiqueta">{t("clientes.compras_totales")}</span>
                      </div>
                      <div>
                        <Clock size={14} />
                        <span className="analisis-clientes-metrica-valor">
                          {s.frecuenciaDias !== null
                            ? t("analisis_clientes.cada_x_dias").replace("{dias}", String(s.frecuenciaDias))
                            : "—"}
                        </span>
                        <span className="analisis-clientes-metrica-etiqueta">{t("analisis_clientes.frecuencia")}</span>
                      </div>
                      <div>
                        <TrendingUp size={14} />
                        <span className="analisis-clientes-metrica-valor">
                          {s.prediccionMensual !== null ? formatoMoneda(s.prediccionMensual) : "—"}
                        </span>
                        <span className="analisis-clientes-metrica-etiqueta">{t("analisis_clientes.prediccion_mes")}</span>
                      </div>
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
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
