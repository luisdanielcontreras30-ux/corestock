"use client";

import "./graficas.css";

import React, { useEffect, useMemo, useState } from "react";
import { DollarSign, ShoppingBag, Box, TrendingUp, Trophy } from "lucide-react";
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

const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: "semanal", etiqueta: "Últimos 7 días" },
  { valor: "mensual", etiqueta: "Este mes" },
  { valor: "anual", etiqueta: "Este año" },
];

export default function GraficasPage() {
  const [loading, setLoading] = useState(true);
  const [ventasCrudas, setVentasCrudas] = useState<VentaCruda[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>("semanal");

  useEffect(() => {
    cargarDatos();
  }, []);

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
    () => agregarPorProducto(ventasActual),
    [ventasActual]
  );

  const topProductos = productosAgregados.slice(0, 4);
  const maxIngresoTop = topProductos.length > 0 ? topProductos[0].ingresos : 1;
  const productosRendimiento = productosAgregados.slice(0, 6);

  if (loading) {
    return (
      <main className="fade-up">
        <div className="card">Cargando gráficas...</div>
      </main>
    );
  }

  return (
    <main className="fade-up">
      <div className="section-title">
        <div>
          <h1>📊 Análisis de Ventas</h1>
          <p>Estadísticas y análisis en tiempo real</p>
        </div>
      </div>

      {/* TARJETAS DE ESTADÍSTICAS */}
      <div className="estadisticas-grid">
        <TarjetaMetrica
          icono={<ShoppingBag size={18} color="#fff" />}
          colorIcono="#7c3aed"
          titulo="Total de ventas"
          valor={String(estadisticas.totalVentas)}
          cambio={cambio.totalVentas}
        />

        <TarjetaMetrica
          icono={<DollarSign size={18} color="#fff" />}
          colorIcono="#10b981"
          titulo="Ingresos totales"
          valor={`$${estadisticas.ingresos.toFixed(2)}`}
          cambio={cambio.ingresos}
        />

        <TarjetaMetrica
          icono={<Box size={18} color="#fff" />}
          colorIcono="#3b82f6"
          titulo="Productos vendidos"
          valor={String(estadisticas.productosVendidos)}
          cambio={cambio.productosVendidos}
        />

        <TarjetaMetrica
          icono={<TrendingUp size={18} color="#fff" />}
          colorIcono="#f97316"
          titulo="Venta promedio"
          valor={`$${estadisticas.ventaPromedio.toFixed(2)}`}
          cambio={cambio.ventaPromedio}
        />
      </div>

      {/* GRÁFICA PRINCIPAL + TOP PRODUCTOS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2.2fr 1fr",
          gap: 24,
          marginTop: 24,
          alignItems: "start",
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
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>Ventas</h2>
              <p style={{ color: "#9ca3af" }}>
                Rendimiento de ventas en el periodo seleccionado
              </p>
            </div>

            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as Periodo)}
              style={{ width: "auto", minWidth: 160 }}
            >
              {PERIODOS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.etiqueta}
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
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#293548" />
                <XAxis dataKey="nombre" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip />

                <Area
                  type="monotone"
                  dataKey="ventas"
                  stroke="#7c3aed"
                  strokeWidth={3}
                  fill="url(#ventas)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* RESUMEN: MEJOR / PEOR / CRECIMIENTO */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              marginTop: 16,
              background: "#0c0d16",
              border: "1px solid #1c1f3b",
              borderRadius: 12,
              padding: "14px 18px",
            }}
          >
            <div>
              <p style={{ color: "#61667a", fontSize: 11, margin: 0 }}>
                📈 Mejor punto
              </p>
              <p
                style={{
                  color: "#a78bfa",
                  fontWeight: 600,
                  fontSize: 13,
                  margin: "4px 0 0 0",
                }}
              >
                {mejorPeorPunto.mejor ? mejorPeorPunto.mejor.nombre : "—"}
              </p>
              <p style={{ color: "#61667a", fontSize: 11, margin: 0 }}>
                {mejorPeorPunto.mejor
                  ? `$${mejorPeorPunto.mejor.ventas.toFixed(2)}`
                  : "Sin datos"}
              </p>
            </div>

            <div>
              <p style={{ color: "#61667a", fontSize: 11, margin: 0 }}>
                📉 Peor punto
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
              <p style={{ color: "#61667a", fontSize: 11, margin: 0 }}>
                {mejorPeorPunto.peor
                  ? `$${mejorPeorPunto.peor.ventas.toFixed(2)}`
                  : "Sin datos"}
              </p>
            </div>

            <div>
              <p style={{ color: "#61667a", fontSize: 11, margin: 0 }}>
                📊 Crecimiento
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
              <p style={{ color: "#61667a", fontSize: 11, margin: 0 }}>
                vs periodo anterior
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
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Top Productos</h2>
          </div>
          <p style={{ color: "#9ca3af", marginBottom: 18 }}>
            Por ingresos generados
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {topProductos.length === 0 ? (
              <p style={{ color: "#61667a", fontSize: 13 }}>
                Sin ventas en este periodo.
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
                      style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}
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

                  <span style={{ color: "#61667a", fontSize: 11 }}>
                    {producto.unidades} unidades
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
          Productos con rendimiento
        </h2>
        <p style={{ color: "#9ca3af", marginBottom: 20 }}>
          Desempeño de cada producto en los últimos 7 días
        </p>

        {productosRendimiento.length === 0 ? (
          <p style={{ color: "#61667a", fontSize: 13 }}>
            No hay ventas registradas todavía.
          </p>
        ) : (
          <div className="productos-grid">
            {productosRendimiento.map((producto, idx) => (
              <div
                key={producto.nombre}
                style={{
                  background: "#0c0d16",
                  border: "1px solid #1c1f3b",
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
                  <span style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>
                    {producto.nombre}
                  </span>
                  <span
                    style={{
                      background: "rgba(124,58,237,0.15)",
                      color: "#a78bfa",
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
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.6} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="nombre"
                        stroke="#4e5264"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="ventas"
                        stroke="#7c3aed"
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
                    color: "#61667a",
                  }}
                >
                  <span>Unidades: {producto.unidades}</span>
                  <span>
                    Precio prom.: $
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

function TarjetaMetrica({
  icono,
  colorIcono,
  titulo,
  valor,
  cambio,
}: {
  icono: React.ReactNode;
  colorIcono: string;
  titulo: string;
  valor: string;
  cambio: number;
}) {
  return (
    <div className="card" style={{ position: "relative", overflow: "hidden" }}>
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
        <p style={{ color: "#9ca3af", fontSize: 13, fontWeight: 500, margin: 0 }}>
          {titulo}
        </p>
      </div>

      <h2 style={{ fontSize: 30, margin: "0 0 6px 0" }}>{valor}</h2>

      <span
        style={{
          color: cambio >= 0 ? "#10b981" : "#ef4444",
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        {cambio >= 0 ? "▲" : "▼"} {Math.abs(cambio).toFixed(0)}% vs periodo
        anterior
      </span>
    </div>
  );
}
