"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ImagePlus, ScanSearch, TrendingUp, DollarSign, Percent, Repeat } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import RequierePlus from "../../components/RequierePlus";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import { analizarProductoConIA } from "../../lib/iaAcciones";
import { mensajeErrorSeguro } from "../../lib/errores";
import { formatoMoneda } from "../ventas/utils";
import { EstadisticasCategoria, ProductoCategoria, ResultadoIA, VentaCategoria } from "./types";
import { cargarDatosAnalisis } from "./acciones";
import { calcularEstadisticasCategoria, encontrarCategoriaExistente } from "./estadisticas";

export default function AnalisisProductoPage() {
  return (
    <RequierePlus>
      <AnalisisProductoContenido />
    </RequierePlus>
  );
}

function AnalisisProductoContenido() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t, idioma } = useIdioma();
  const { mostrarToast } = useToast();

  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [productos, setProductos] = useState<ProductoCategoria[]>([]);
  const [ventas, setVentas] = useState<VentaCategoria[]>([]);

  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [analizando, setAnalizando] = useState(false);
  const [resultadoIA, setResultadoIA] = useState<ResultadoIA | null>(null);
  const [estadisticas, setEstadisticas] = useState<EstadisticasCategoria | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cargandoAuth) return;

    if (!user) {
      router.push("/login");
      return;
    }

    (async () => {
      try {
        const datos = await cargarDatosAnalisis();
        setProductos(datos.productos);
        setVentas(datos.ventas);
      } catch (error) {
        console.error(error);
        mostrarToast(t("comun.msg_error_cargar_datos"), "error");
      } finally {
        setCargandoDatos(false);
      }
    })();
  }, [cargandoAuth, user]);

  // Se le pasa a la IA para que reutilice una categoría existente del
  // negocio en vez de inventar una variante casi idéntica — mismo
  // patrón que ya usa "Agregar producto".
  const categoriasExistentes = useMemo(
    () =>
      Array.from(
        new Set(productos.map((p) => p.categoria).filter((c): c is string => !!c?.trim()))
      ).sort((a, b) => a.localeCompare(b)),
    [productos]
  );

  function manejarArchivo(file: File) {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setImagen(file);
    setPreview(URL.createObjectURL(file));
    setResultadoIA(null);
    setEstadisticas(null);
  }

  async function analizar() {
    if (!imagen || analizando) return;

    setAnalizando(true);
    try {
      const resultado = await analizarProductoConIA(imagen, idioma, categoriasExistentes);
      setResultadoIA(resultado);

      const categoriaFinal = resultado.categoria
        ? encontrarCategoriaExistente(resultado.categoria, productos) ?? resultado.categoria
        : "";

      setEstadisticas(
        categoriaFinal ? calcularEstadisticasCategoria(categoriaFinal, productos, ventas) : null
      );
    } catch (error) {
      console.error(error);
      const detalle = mensajeErrorSeguro(error);
      mostrarToast(detalle || t("analisis.msg_error_analizar"), "error");
    } finally {
      setAnalizando(false);
    }
  }

  function analizarOtra() {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setImagen(null);
    setPreview("");
    setResultadoIA(null);
    setEstadisticas(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (cargandoAuth || !user) {
    return (
      <main className="fade-up">
        <div className="card">{t("header.cargando")}</div>
      </main>
    );
  }

  return (
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <EncabezadoModulo
        Icono={ScanSearch}
        color="#c026d3"
        titulo={t("analisis.titulo")}
        subtitulo={t("analisis.subtitulo")}
      />

      <div className="card" style={{ maxWidth: 480 }}>
        <div
          className="upload-box"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) manejarArchivo(file);
          }}
        >
          {!preview ? (
            <>
              <ImagePlus size={34} color="var(--text-muted)" />
              <p>{t("analisis.subir_foto")}</p>
              <p className="upload-box-subtexto">{t("productos.subir_imagen_subtexto")}</p>
            </>
          ) : (
            <img src={preview} alt={t("analisis.subir_foto")} className="upload-box-preview" />
          )}
        </div>

        <input
          hidden
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) manejarArchivo(file);
          }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            type="button"
            className="btn-primary"
            disabled={!imagen || analizando || cargandoDatos}
            onClick={analizar}
          >
            {analizando ? t("analisis.analizando") : t("analisis.boton_analizar")}
          </button>

          {(preview || resultadoIA) && (
            <button type="button" className="btn-secondary" onClick={analizarOtra} disabled={analizando}>
              {t("analisis.analizar_otra")}
            </button>
          )}
        </div>
      </div>

      {resultadoIA && (
        <div className="card fade-up">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{resultadoIA.nombre}</h2>
            {resultadoIA.categoria && (
              <span className="analisis-badge-categoria">{resultadoIA.categoria}</span>
            )}
          </div>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>{resultadoIA.descripcion}</p>

          {estadisticas?.tieneProductos ? (
            <ResultadoEstadisticas estadisticas={estadisticas} t={t} />
          ) : (
            <div className="analisis-vacio">
              <p>{t("analisis.msg_categoria_nueva")}</p>
            </div>
          )}

          <Link
            href={{
              pathname: "/productos",
              query: {
                nombre_sugerido: resultadoIA.nombre,
                categoria_sugerida: resultadoIA.categoria,
                descripcion_sugerida: resultadoIA.descripcion,
              },
            }}
            className="btn-secondary"
            style={{ display: "inline-block", marginTop: 16, textDecoration: "none", textAlign: "center" }}
          >
            {t("analisis.agregar_al_inventario")}
          </Link>
        </div>
      )}
    </main>
  );
}

function ResultadoEstadisticas({
  estadisticas,
  t,
}: {
  estadisticas: EstadisticasCategoria;
  t: (clave: string) => string;
}) {
  const {
    productosEnCategoria,
    unidadesPromedioMes,
    precioPromedio,
    margenPromedioPct,
    ingresosPromedioMes,
    gananciaEstimadaMensual,
    frecuencia,
    ventasPorMes,
    tieneVentas,
  } = estadisticas;

  return (
    <div style={{ marginTop: 18 }}>
      <p className="upload-box-subtexto" style={{ marginBottom: 12 }}>
        {t("analisis.basado_en").replace("{n}", String(productosEnCategoria))}
      </p>

      {!tieneVentas ? (
        <div className="analisis-vacio">
          <p>{t("analisis.msg_sin_ventas")}</p>
        </div>
      ) : (
        <>
          <div className="analisis-stat-grid">
            <div className="analisis-stat">
              <span className="analisis-stat-icono" style={{ background: "#3b82f6" }}>
                <TrendingUp size={16} color="#fff" />
              </span>
              <div>
                <p className="analisis-stat-label">{t("analisis.unidades_mes")}</p>
                <p className="analisis-stat-valor">{unidadesPromedioMes.toFixed(1)}</p>
              </div>
            </div>

            <div className="analisis-stat">
              <span className="analisis-stat-icono" style={{ background: "#10b981" }}>
                <DollarSign size={16} color="#fff" />
              </span>
              <div>
                <p className="analisis-stat-label">{t("analisis.ingreso_estimado_mes")}</p>
                <p className="analisis-stat-valor">{formatoMoneda(ingresosPromedioMes)}</p>
              </div>
            </div>

            <div className="analisis-stat">
              <span className="analisis-stat-icono" style={{ background: "#f59e0b" }}>
                <Percent size={16} color="#fff" />
              </span>
              <div>
                <p className="analisis-stat-label">{t("analisis.margen_promedio")}</p>
                <p className="analisis-stat-valor">
                  {margenPromedioPct != null ? `${(margenPromedioPct * 100).toFixed(0)}%` : "—"}
                </p>
              </div>
            </div>

            <div className="analisis-stat">
              <span className="analisis-stat-icono" style={{ background: "#8b5cf6" }}>
                <Repeat size={16} color="#fff" />
              </span>
              <div>
                <p className="analisis-stat-label">{t("analisis.frecuencia_compra")}</p>
                <p className="analisis-stat-valor">
                  {frecuencia ? t(`analisis.frecuencia_${frecuencia}`) : "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 14, background: "var(--glass-bg)" }}>
            <p className="analisis-stat-label" style={{ marginBottom: 8 }}>
              {t("analisis.ganancia_estimada_mes")}:{" "}
              <strong style={{ color: "#10b981" }}>
                {margenPromedioPct != null ? formatoMoneda(gananciaEstimadaMensual) : "—"}
              </strong>
            </p>

            <div style={{ width: "100%", height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ventasPorMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="mes" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8 }}
                    formatter={(valor) => `${Number(valor)} ${t("analisis.unidades")}`}
                  />
                  <Bar dataKey="unidades" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {precioPromedio > 0 && (
        <p className="upload-box-subtexto" style={{ marginTop: 10 }}>
          {t("analisis.precio_referencia")}: {formatoMoneda(precioPromedio)}
        </p>
      )}

      <p className="upload-box-subtexto" style={{ marginTop: 10, fontStyle: "italic" }}>
        {t("analisis.disclaimer")}
      </p>
    </div>
  );
}
