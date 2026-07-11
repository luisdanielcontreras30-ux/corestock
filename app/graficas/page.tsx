"use client";

import "./graficas.css";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, ShoppingBag, Box, TrendingUp, TrendingDown, BarChart3, Trophy } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { obtenerDatosGraficas } from "./acciones";
import {
  agruparPorPeriodo,
  filtrarPorPeriodo,
  agregarPorProducto,
  calcularPorcentaje,
  Periodo,
} from "./utils";
import { VentaCruda } from "./types";
import { useIdioma } from "../../components/LanguageProvider";
import { useTheme } from "../../components/ThemeProvider";
import { useAuth } from "../../components/AuthProvider";
import { obtenerPaletaGrafica } from "../../lib/chartColors";
import ContadorAnimado from "../../components/ContadorAnimado";

const PERIODOS: { valor: Periodo; clave: string }[] = [
  { valor: "semanal", clave: "graficas.periodo_semanal" },
  { valor: "mensual", clave: "graficas.periodo_mensual" },
  { valor: "anual", clave: "graficas.periodo_anual" },
];

export default function GraficasPage() {
  const { t } = useIdioma();
  const { tema } = useTheme();
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const COLORES_PIE = obtenerPaletaGrafica(tema);
  const [loading, setLoading] = useState(true);
  const [ventasCrudas, setVentasCrudas] = useState<VentaCruda[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>("semanal");

  useEffect(() => {
    if (cargandoAuth) return;

    if (!user) {
      router.push("/login");
      return;
    }

    cargarDatos();
  }, [cargandoAuth, user]);

  async function cargarDatos() {
    try {
      setLoading(true);
      const datos = await obtenerDatosGraficas();
      setVentasCrudas(datos);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const ventasActual = useMemo(
    () => filtrarPorPeriodo(ventasCrudas, periodo, 0),
    [ventasCrudas, periodo]
  );

  const ventasAnterior = useMemo(
    () => filtrarPorPeriodo(ventasCrudas, periodo, 1),
    [ventasCrudas, periodo]
  );

  const puntosGrafica = useMemo(
    () => agruparPorPeriodo(ventasActual, periodo),
    [ventasActual, periodo]
  );

  const estadisticas = useMemo(() => {
    const totalVentas = ventasActual.length;
    const ingresos = ventasActual.reduce((acc, v) => acc + v.total, 0);
    const productosVendidos = ventasActual.reduce(
      (acc, v) => acc + v.cantidad,
      0
    );
    const ventaPromedio = totalVentas > 0 ? ingresos / totalVentas : 0;

    return { totalVentas, ingresos, productosVendidos, ventaPromedio };
  }, [ventasActual]);

  const estadisticasAnterior = useMemo(() => {
    const totalVentas = ventasAnterior.length;
    const ingresos = ventasAnterior.reduce((acc, v) => acc + v.total, 0);
    const productosVendidos = ventasAnterior.reduce(
      (acc, v) => acc + v.cantidad,
      0
    );
    const ventaPromedio = totalVentas > 0 ? ingresos / totalVentas : 0;

    return { totalVentas, ingresos, productosVendidos, ventaPromedio };
  }, [ventasAnterior]);

  const cambio = {
    totalVentas: calcularPorcentaje(
      estadisticas.totalVentas,
      estadisticasAnterior.totalVentas
    ),
    ingresos: calcularPorcentaje(
      estadisticas.ingresos,
      estadisticasAnterior.ingresos
    ),
    productosVendidos: calcularPorcentaje(
      estadisticas.productosVendidos,
      estadisticasAnterior.productosVendidos
    ),
    ventaPromedio: calcularPorcentaje(
      estadisticas.ventaPromedio,
      estadisticasAnterior.ventaPromedio
    ),
  };

  const mejorPeorPunto = useMemo(() => {
    const conVentas = puntosGrafica.filter((p) => p.ventas > 0);
    if (conVentas.length === 0) {
      return { mejor: null, peor: null };
    }

    const mejor = conVentas.reduce((a, b) => (b.ventas > a.ventas ? b : a));
    const peor = conVentas.reduce((a, b) => (b.ventas < a.ventas ? b : a));

    return { mejor, peor };
  }, [puntosGrafica]);

  const productosAgregados = useMemo(
    () => agregarPorProducto(ventasActual, ventasCrudas),
    [ventasActual, ventasCrudas]
  );

  const topProductos = productosAgregados.slice(0, 4);
  const maxIngresoTop = topProductos.length > 0 ? topProductos[0].ingresos : 1;
  const productosRendimiento = productosAgregados.slice(0, 6);

  if (cargandoAuth || !user || loading) {
    return (
      <main className="fade-up">
        <div className="card">{t("graficas.cargando")}</div>
      </main>
    );
  }

  return (
    <main className="fade-up">
      <div className="section-title">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BarChart3 size={26} /> {t("graficas.titulo")}
          </h1>
          <p>{t("graficas.subtitulo")}</p>
        </div>
      </div>

      {/* TARJETAS DE ESTADÍSTICAS: GRID ASIMÉTRICO */}
      <div className="dashboard-hero-grid">
        {/* HÉROE: INGRESOS TOTALES, con sparkline de la gráfica principal */}
        <div
          className="dashboard-card-hero card"
          style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: COLORES_PIE[0], display: "grid", placeItems: "center" }}>
                <DollarSign size={19} color="#fff" />
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "12.5px", fontWeight: 600, textTransform: "uppercase", margin: 0 }}>
                {t("graficas.ingresos_totales")}
              </p>
            </div>
            <h2 style={{ fontSize: 34, fontWeight: 700, margin: "0 0 6px 0" }}>
              $<ContadorAnimado valor={estadisticas.ingresos} decimales={2} />
            </h2>
            <span style={{ color: cambio.ingresos >= 0 ? "#10b981" : "#ef4444", fontSize: 12.5 }}>
              {cambio.ingresos >= 0 ? "▲" : "▼"} {Math.abs(cambio.ingresos).toFixed(0)}% {t("graficas.vs_periodo_anterior")}
            </span>
          </div>

          <div style={{ width: "100%", height: 70, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={puntosGrafica} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sparkIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORES_PIE[0]} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={COLORES_PIE[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="ventas" stroke={COLORES_PIE[0]} strokeWidth={2} fill="url(#sparkIngresos)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dashboard-card-mes card">
          <TarjetaMetricaContenido
            icono={<ShoppingBag size={18} color="#fff" />}
            colorIcono={COLORES_PIE[1]}
            titulo={t("graficas.total_ventas")}
            valor={estadisticas.totalVentas}
            decimales={0}
            cambio={cambio.totalVentas}
          />
        </div>

        <div className="dashboard-card-prod card">
          <TarjetaMetricaContenido
            icono={<Box size={18} color="#fff" />}
            colorIcono={COLORES_PIE[2]}
            titulo={t("graficas.productos_vendidos")}
            valor={estadisticas.productosVendidos}
            decimales={0}
            cambio={cambio.productosVendidos}
          />
        </div>

        <div className="dashboard-card-alertas card">
          <TarjetaMetricaContenido
            icono={<TrendingUp size={18} color="#fff" />}
            colorIcono={COLORES_PIE[3]}
            titulo={t("graficas.venta_promedio")}
            valor={estadisticas.ventaPromedio}
            decimales={2}
            prefijo="$"
            cambio={cambio.ventaPromedio}
          />
        </div>
      </div>

      {/* GRÁFICA PRINCIPAL + TOP PRODUCTOS */}
      <div
        className="graficas-split-layout"
        style={{
          marginTop: 24,
        }}
      >
        <div className="card" style={{ padding: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>{t("graficas.ventas_card")}</h2>
              <p style={{ color: "var(--text-secondary)" }}>
                {t("graficas.rendimiento_periodo")}
              </p>
            </div>

            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as Periodo)}
              style={{ width: "auto", minWidth: 160 }}
            >
              {PERIODOS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {t(p.clave)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={puntosGrafica}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="ventas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="nombre" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" />
                <Tooltip />

                <Area
                  type="monotone"
                  dataKey="ventas"
                  stroke="var(--primary)"
                  strokeWidth={3}
                  fill="url(#ventas)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* RESUMEN: MEJOR / PEOR / CRECIMIENTO */}
          <div
            className="resumen-3col"
            style={{
              marginTop: 16,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "14px 18px",
            }}
          >
            <div>
              <p style={{ color: "var(--text-secondary)", fontSize: 11, margin: 0, display: "flex", alignItems: "center", gap: 5 }}>
                <TrendingUp size={12} /> {t("graficas.mejor_punto")}
              </p>
              <p
                style={{
                  color: COLORES_PIE[0],
                  fontWeight: 600,
                  fontSize: 13,
                  margin: "4px 0 0 0",
                }}
              >
                {mejorPeorPunto.mejor ? mejorPeorPunto.mejor.nombre : "—"}
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: 11, margin: 0 }}>
                {mejorPeorPunto.mejor
                  ? `$${mejorPeorPunto.mejor.ventas.toFixed(2)}`
                  : t("graficas.sin_datos")}
              </p>
            </div>

            <div>
              <p style={{ color: "var(--text-secondary)", fontSize: 11, margin: 0, display: "flex", alignItems: "center", gap: 5 }}>
                <TrendingDown size={12} /> {t("graficas.peor_punto")}
              </p>
              <p
                style={{
                  color: "#f472b6",
                  fontWeight: 600,
                  fontSize: 13,
                  margin: "4px 0 0 0",
                }}
              >
                {mejorPeorPunto.peor ? mejorPeorPunto.peor.nombre : "—"}
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: 11, margin: 0 }}>
                {mejorPeorPunto.peor
                  ? `$${mejorPeorPunto.peor.ventas.toFixed(2)}`
                  : t("graficas.sin_datos")}
              </p>
            </div>

            <div>
              <p style={{ color: "var(--text-secondary)", fontSize: 11, margin: 0, display: "flex", alignItems: "center", gap: 5 }}>
                <BarChart3 size={12} /> {t("graficas.crecimiento")}
              </p>
              <p
                style={{
                  color: cambio.ingresos >= 0 ? "#10b981" : "#ef4444",
                  fontWeight: 600,
                  fontSize: 13,
                  margin: "4px 0 0 0",
                }}
              >
                {cambio.ingresos >= 0 ? "+" : ""}
                {cambio.ingresos.toFixed(0)}%
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: 11, margin: 0 }}>
                {t("graficas.vs_periodo_anterior")}
              </p>
            </div>
          </div>
        </div>

        {/* TOP PRODUCTOS */}
        <div className="card" style={{ padding: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Trophy size={16} color="#f59e0b" />
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>{t("graficas.top_productos")}</h2>
          </div>
          <p style={{ color: "var(--text-secondary)", marginBottom: 18 }}>
            {t("graficas.por_ingresos")}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {topProductos.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                {t("graficas.sin_ventas_periodo")}
              </p>
            ) : (
              topProductos.map((producto, idx) => (
                <div key={producto.nombre}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}
                    >
                      #{idx + 1} {producto.nombre}
                    </span>
                    <span
                      style={{
                        color: "#10b981",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      ${producto.ingresos.toFixed(2)}
                    </span>
                  </div>

                  <div className="top-bar">
                    <div
                      className="top-fill"
                      style={{
                        width: `${(producto.ingresos / maxIngresoTop) * 100}%`,
                      }}
                    />
                  </div>

                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                    {producto.unidades} {t("graficas.unidades")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PRODUCTOS CON RENDIMIENTO */}
      <div className="card" style={{ padding: 24, marginTop: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>
          {t("graficas.productos_rendimiento")}
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
          {t("graficas.desempeno_7dias")}
        </p>

        {productosRendimiento.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            {t("graficas.sin_ventas_aun")}
          </p>
        ) : (
          <div className="productos-grid">
            {productosRendimiento.map((producto, idx) => (
              <div
                key={producto.nombre}
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 10,
                  }}
                >
                  <span style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>
                    {producto.nombre}
                  </span>
                  <span
                    style={{
                      background: "var(--primary-soft)",
                      color: "var(--primary)",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}
                  >
                    #{idx + 1}
                  </span>
                </div>

                <span style={{ color: "#10b981", fontSize: 22, fontWeight: 700 }}>
                  ${producto.ingresos.toFixed(2)}
                </span>

                <div style={{ width: "100%", height: 90, marginTop: 8 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={producto.historial}>
                      <defs>
                        <linearGradient
                          id={`mini-${idx}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.6} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="nombre"
                        stroke="var(--text-muted)"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="ventas"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        fill={`url(#mini-${idx})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    marginTop: 8,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                  }}
                >
                  <span>{t("graficas.unidades").charAt(0).toUpperCase() + t("graficas.unidades").slice(1)}: {producto.unidades}</span>
                  <span>
                    {t("graficas.precio_prom")}: $
                    {producto.unidades > 0
                      ? (producto.ingresos / producto.unidades).toFixed(2)
                      : "0.00"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function TarjetaMetricaContenido({
  icono,
  colorIcono,
  titulo,
  valor,
  decimales,
  prefijo = "",
  cambio,
}: {
  icono: React.ReactNode;
  colorIcono: string;
  titulo: string;
  valor: number;
  decimales: number;
  prefijo?: string;
  cambio: number;
}) {
  const { t } = useIdioma();

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: colorIcono,
            display: "grid",
            placeItems: "center",
          }}
        >
          {icono}
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 500, margin: 0 }}>
          {titulo}
        </p>
      </div>

      <h2 style={{ fontSize: 26, margin: "0 0 6px 0" }}>
        {prefijo}
        <ContadorAnimado valor={valor} decimales={decimales} />
      </h2>

      <span
        style={{
          color: cambio >= 0 ? "#10b981" : "#ef4444",
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        {cambio >= 0 ? "▲" : "▼"} {Math.abs(cambio).toFixed(0)}% {t("graficas.vs_periodo_anterior")}
      </span>
    </>
  );
}
