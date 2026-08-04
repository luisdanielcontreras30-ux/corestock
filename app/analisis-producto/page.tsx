"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  ResponsiveContainer,
  Tooltip,
  YAxis,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import CargandoLista from "../../components/CargandoLista";
import { ImagePlus, ScanSearch, TrendingUp, DollarSign, Percent, Repeat, Camera, Sparkles, LineChart, Info, Globe } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useTheme } from "../../components/ThemeProvider";
import { obtenerPaletaGrafica } from "../../lib/chartColors";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import RequierePlus from "../../components/RequierePlus";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import IaNoDisponible from "../../components/IaNoDisponible";
import { analizarProductoConIA } from "../../lib/iaAcciones";
import { mensajeErrorSeguro } from "../../lib/errores";
import { IA_DISPONIBLE } from "../../lib/soporte";
import { formatoMoneda } from "../ventas/utils";
import { EstadisticasCategoria, EstimacionMercado, ProductoCategoria, ResultadoIA, VentaCategoria } from "./types";
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

  const [cargandoDatos, setCargandoDatos] = useState(IA_DISPONIBLE);
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

    if (!IA_DISPONIBLE) return;

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
        <CargandoLista />
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

      {!IA_DISPONIBLE ? (
        <IaNoDisponible />
      ) : (
        <>
          <div className="analisis-layout">
          <div className="card analisis-panel-subida">
            <h2 className="analisis-panel-titulo">
              <Camera size={17} /> {t("analisis.paso_subir")}
            </h2>

            <div
              className="upload-box analisis-upload"
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
                // preview es un blob: URL de URL.createObjectURL(), nunca
                // toca la red — no hay nada que next/image optimice aquí,
                // y ese componente no soporta blob: sin unoptimized.
                // eslint-disable-next-line @next/next/no-img-element
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

          {/* La columna derecha nunca queda vacía: antes del primer
              análisis explica qué hace la pantalla en tres pasos. Sin
              esto, en un monitor ancho la página era una caja chica en
              la esquina y todo lo demás negro — parecía rota, no vacía. */}
          {!resultadoIA ? (
            <div className="card analisis-explica">
              <h2 className="analisis-panel-titulo">
                <Sparkles size={17} /> {t("analisis.como_funciona")}
              </h2>

              <ol className="analisis-pasos">
                <li>
                  <span className="analisis-paso-numero">1</span>
                  <div>
                    <strong>{t("analisis.paso1_titulo")}</strong>
                    <p>{t("analisis.paso1_texto")}</p>
                  </div>
                </li>
                <li>
                  <span className="analisis-paso-numero">2</span>
                  <div>
                    <strong>{t("analisis.paso2_titulo")}</strong>
                    <p>{t("analisis.paso2_texto")}</p>
                  </div>
                </li>
                <li>
                  <span className="analisis-paso-numero">3</span>
                  <div>
                    <strong>{t("analisis.paso3_titulo")}</strong>
                    <p>{t("analisis.paso3_texto")}</p>
                  </div>
                </li>
              </ol>

              <div className="analisis-explica-nota">
                <LineChart size={15} />
                <p>{t("analisis.nota_historial")}</p>
              </div>
            </div>
          ) : (
            /* Con resultado, la columna derecha lleva la ficha del
               producto Y las métricas debajo. La ficha sola es corta y
               dejaba media pantalla negra al lado del panel de la foto,
               que es alto. Antes del análisis no hace falta: ahí la
               columna la llena la explicación de tres pasos, y las
               métricas van en su banda de ancho completo más abajo. */
            <div className="analisis-columna-resultado">
            <div className="card fade-up analisis-resultado">
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <h2 style={{ margin: 0, fontSize: 20 }}>{resultadoIA.nombre}</h2>
                {resultadoIA.categoria && (
                  <span className="analisis-badge-categoria">{resultadoIA.categoria}</span>
                )}
              </div>
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>{resultadoIA.descripcion}</p>

              <Link
                href={{
                  pathname: "/productos",
                  query: {
                    nombre_sugerido: resultadoIA.nombre,
                    categoria_sugerida: resultadoIA.categoria,
                    descripcion_sugerida: resultadoIA.descripcion,
                  },
                }}
                className="btn-primary analisis-boton-agregar"
              >
                {t("analisis.agregar_al_inventario")}
              </Link>
            </div>

              <BandaEstadisticas estadisticas={estadisticas} t={t} />
            </div>
          )}
          </div>

          {/* Sin resultado las métricas no caben arriba (la columna la
              ocupa la explicación), así que van aquí en ancho completo
              y en guiones, marcando el sitio que van a ocupar. */}
          {!resultadoIA && <BandaEstadisticas estadisticas={null} t={t} />}

          {/* Las dos gráficas se dibujan SIEMPRE, aunque todavía no se
              haya analizado nada: con sus ejes, vacías y con una línea
              que dice qué va a aparecer ahí. Una pantalla que enseña de
              entrada la forma que va a tener se entiende antes que una
              que aparece a trozos según lo que vayas haciendo. */}
          <div className="analisis-graficas">
            <div className="card analisis-mercado-tarjeta">
              <h3 className="analisis-panel-titulo">
                <Globe size={17} /> {t("analisis.mercado_titulo")}
              </h3>

              <EstimacionDeMercado
                mercado={resultadoIA?.mercado ?? null}
                margenPropio={estadisticas?.margenPromedioPct ?? null}
                t={t}
              />
            </div>

            <div className="card analisis-historial">
              <h3 className="analisis-panel-titulo">
                <LineChart size={17} /> {t("analisis.historial_titulo")}
              </h3>

              {!resultadoIA ? (
                <GraficaHistorialVacia t={t} />
              ) : estadisticas?.tieneProductos ? (
                <ResultadoEstadisticas estadisticas={estadisticas} t={t} />
              ) : (
                <div className="analisis-vacio">
                  <p>{t("analisis.msg_categoria_nueva")}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

// Banda de métricas entre el panel de subida y las gráficas.
//
// Estas cuatro cifras vivían dentro de la tarjeta del historial, que
// quedaba apretada mientras la franja de en medio de la página estaba
// vacía. Sacarlas aquí llena ese hueco y descongestiona la tarjeta de
// abajo con el mismo contenido — no se inventa nada nuevo.
//
// Se dibuja siempre, con "—" mientras no haya nada que enseñar, igual
// que las gráficas: la pantalla enseña de entrada la forma que va a
// tener en vez de aparecer a trozos.
function BandaEstadisticas({
  estadisticas,
  t,
}: {
  estadisticas: EstadisticasCategoria | null;
  t: (clave: string) => string;
}) {
  // Sin ventas en la categoría los promedios son cero, y un cero se lee
  // como "vendes cero" en vez de "todavía no sé". Por eso el guion.
  const datos = estadisticas?.tieneVentas ? estadisticas : null;

  const metricas = [
    {
      color: "#3b82f6",
      icono: <TrendingUp size={16} color="#fff" />,
      label: t("analisis.unidades_mes"),
      valor: datos ? datos.unidadesPromedioMes.toFixed(1) : "—",
    },
    {
      color: "#10b981",
      icono: <DollarSign size={16} color="#fff" />,
      label: t("analisis.ingreso_estimado_mes"),
      valor: datos ? formatoMoneda(datos.ingresosPromedioMes) : "—",
    },
    {
      color: "#f59e0b",
      icono: <Percent size={16} color="#fff" />,
      label: t("analisis.margen_promedio"),
      valor:
        datos?.margenPromedioPct != null
          ? `${(datos.margenPromedioPct * 100).toFixed(0)}%`
          : "—",
    },
    {
      color: "#8b5cf6",
      icono: <Repeat size={16} color="#fff" />,
      label: t("analisis.frecuencia_compra"),
      valor: datos?.frecuencia ? t(`analisis.frecuencia_${datos.frecuencia}`) : "—",
    },
  ];

  return (
    <div className="analisis-banda">
      {metricas.map((metrica) => (
        <div className="card analisis-stat" key={metrica.label}>
          <span className="analisis-stat-icono" style={{ background: metrica.color }}>
            {metrica.icono}
          </span>
          <div>
            <p className="analisis-stat-label">{metrica.label}</p>
            <p className="analisis-stat-valor">{metrica.valor}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultadoEstadisticas({
  estadisticas,
  t,
}: {
  estadisticas: EstadisticasCategoria;
  t: (clave: string) => string;
}) {
  // Las métricas por separado (unidades, ingreso, margen, frecuencia)
  // ya no salen aquí: viven en la banda de arriba, BandaEstadisticas.
  const {
    productosEnCategoria,
    precioPromedio,
    margenPromedioPct,
    gananciaEstimadaMensual,
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
          <div className="card" style={{ marginTop: 14, background: "var(--glass-bg)" }}>
            <p className="analisis-stat-label" style={{ marginBottom: 8 }}>
              {t("analisis.ganancia_estimada_mes")}:{" "}
              <strong style={{ color: "#10b981" }}>
                {margenPromedioPct != null ? formatoMoneda(gananciaEstimadaMensual) : "—"}
              </strong>
            </p>

            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ventasPorMes} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="analisisHistorial" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.25} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="mes" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "var(--text-secondary)", fontSize: "12px" }}
                    itemStyle={{ color: "var(--text-primary)", fontSize: "13px" }}
                    formatter={(valor) => `${Number(valor)} ${t("analisis.unidades")}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="unidades"
                    name={t("analisis.unidades")}
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#analisisHistorial)"
                  />
                </AreaChart>
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


// Estimación de mercado del modelo, con gráficas.
//
// TODO lo de aquí es una aproximación: son cifras que el modelo conoce
// del comercio en general, NO mediciones de ningún negocio ni datos
// consultados en internet. Por eso el aviso no está escondido en letra
// chica al final: va arriba, antes de los números, porque quien los lee
// va a decidir con ellos en qué gastar su dinero.
function EstimacionDeMercado({
  mercado,
  margenPropio,
  t,
}: {
  // null = todavía no se ha analizado nada. Se dibuja igual, con los
  // ejes y los medidores en cero, para que la pantalla no aparezca a
  // trozos según lo que hayas hecho.
  mercado: EstimacionMercado | null;
  margenPropio: number | null;
  t: (clave: string) => string;
}) {
  const { tema } = useTheme();
  const paleta = obtenerPaletaGrafica(tema);
  const vacio = mercado === null;
  const margenMedio = mercado ? Math.round((mercado.margenMin + mercado.margenMax) / 2) : 0;

  // La comparación solo se dibuja si el negocio YA vende esa categoría:
  // sin margen propio no hay nada contra qué comparar, y una barra sola
  // en un gráfico de dos parece un dato faltante.
  // Vacío: las dos barras existen pero valen cero, así el eje y las
  // etiquetas se dibujan y se ve DÓNDE va a aparecer cada cosa.
  const datosMargen = (
    vacio
      ? [
          { nombre: t("analisis.mercado_tipico"), valor: 0 },
          { nombre: t("analisis.mercado_tuyo"), valor: 0 },
        ]
      : [
          { nombre: t("analisis.mercado_tipico"), valor: margenMedio },
          ...(margenPropio !== null
            ? [{ nombre: t("analisis.mercado_tuyo"), valor: Math.round(margenPropio) }]
            : []),
        ]
  ).map((fila, i) => ({ ...fila, fill: paleta[i % paleta.length] }));

  return (
    <div className="analisis-mercado">
      <div className="analisis-mercado-aviso">
        <Info size={15} />
        <p>{t("analisis.mercado_aviso")}</p>
      </div>

      <div className="analisis-mercado-grid">
        <div>
          <p className="analisis-mercado-etiqueta">
            {t("analisis.mercado_margen")}{" "}
            <strong>{mercado ? `${mercado.margenMin}% – ${mercado.margenMax}%` : "—"}</strong>
          </p>
          {/* Anillos, no barras. El margen ya es un porcentaje sobre 100,
              así que un medidor circular lo dice sin necesidad de eje: el
              arco lleno ES la fracción. Los colores salen de la paleta del
              tema, igual que las gráficas del dashboard — nada de neón. */}
          <div style={{ width: "100%", height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                data={datosMargen}
                innerRadius="42%"
                outerRadius="95%"
                startAngle={90}
                endAngle={-270}
                barSize={13}
              >
                {/* El dominio fijo 0-100 es lo que convierte el anillo en
                    medidor: sin él recharts escala al valor más grande y
                    un margen del 30% se vería lleno. */}
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar
                  dataKey="valor"
                  name={t("analisis.mercado_margen_corto")}
                  background={{ fill: "var(--card-hover)" }}
                  cornerRadius={7}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "var(--text-secondary)", fontSize: "12px" }}
                  itemStyle={{ color: "var(--text-primary)", fontSize: "13px" }}
                  formatter={(valor) => `${Number(valor) || 0}%`}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>

          {/* El anillo por sí solo no dice cuál es cuál: la leyenda lleva
              el color, el nombre y el número, que es lo que se busca. */}
          <div className="analisis-mercado-leyenda">
            {datosMargen.map((fila) => (
              <span key={fila.nombre}>
                <i style={{ background: fila.fill }} />
                {fila.nombre}
                <strong>{vacio ? "—" : `${fila.valor}%`}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="analisis-mercado-medidores">
          <Medidor
            etiqueta={t("analisis.mercado_rotacion")}
            valor={mercado?.rotacion ?? 0}
            color={paleta[0]}
          />
          <Medidor
            etiqueta={t("analisis.mercado_demanda")}
            valor={mercado?.demanda ?? 0}
            color={paleta[1] ?? paleta[0]}
          />
        </div>
      </div>

      {mercado?.nota ? (
        <p className="analisis-mercado-nota">{mercado.nota}</p>
      ) : vacio ? (
        <p className="analisis-mercado-nota">{t("analisis.mercado_pendiente")}</p>
      ) : null}
    </div>
  );
}

// Barra de 1 a 5. Se dibujan los cinco segmentos siempre, llenos o
// vacíos: así el 3 se lee como "3 de 5" y no como un porcentaje suelto.
function Medidor({
  etiqueta,
  valor,
  color,
}: {
  etiqueta: string;
  valor: number;
  color: string;
}) {
  return (
    <div className="analisis-medidor">
      <div className="analisis-medidor-fila">
        <span>{etiqueta}</span>
        <strong>{valor > 0 ? `${valor} / 5` : "—"}</strong>
      </div>
      <div className="analisis-medidor-barras" role="img" aria-label={`${etiqueta}: ${valor} / 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            style={n <= valor ? { background: color, borderColor: color } : undefined}
          />
        ))}
      </div>
    </div>
  );
}


// Historial del negocio antes de haber analizado nada: los mismos ejes
// y la misma área que tendrá con datos, pero plana en cero. Se dibuja
// para que la pantalla enseñe de entrada la forma que va a tener, en
// vez de aparecer a trozos conforme se usa.
function GraficaHistorialVacia({ t }: { t: (clave: string) => string }) {
  const meses = [1, 2, 3, 4, 5, 6].map((n) => ({ mes: String(n), unidades: 0 }));

  return (
    <>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={meses} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="analisisHistorialVacio" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--text-muted)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--text-muted)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis dataKey="mes" stroke="var(--text-muted)" fontSize={11} tickLine={false} hide />
            <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
            <Area
              type="monotone"
              dataKey="unidades"
              stroke="var(--text-muted)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#analisisHistorialVacio)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="analisis-mercado-nota">{t("analisis.historial_pendiente")}</p>
    </>
  );
}
