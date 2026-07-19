"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  CalendarDays,
  Package,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  LogOut,
  Zap,
} from "lucide-react";
import { useTheme } from "../../components/ThemeProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { LOCALES } from "../../lib/i18n";
import { useAuth } from "../../components/AuthProvider";
import { useMiembroActivo } from "../../components/MiembroActivoProvider";
import { useModoInterfaz } from "../../components/ModoInterfazProvider";
import ContadorAnimado from "../../components/ContadorAnimado";
import { obtenerPaletaGrafica } from "../../lib/chartColors";
import { useToast } from "../../components/ToastProvider";
import { cargarMovimientos, calcularSaldo } from "../caja/acciones";
import { formatoMoneda } from "../ventas/utils";
import SelectorPersonalizado, { OpcionSelector } from "../../components/SelectorPersonalizado";
import DashboardEasy from "./DashboardEasy";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface VentaReciente {
  id: string;
  producto: string;
  cantidad: number;
  total: number;
  fecha: string;
  cliente_id: number | null;
}

interface ClienteTop {
  nombre: string;
  total: number;
}

interface ProductoStockBajo {
  id: number;
  nombre: string;
  stock: number;
  stock_minimo: number | null;
}

interface DataGraficoLinea {
  fecha: string;
  monto: number;
}

interface DataGraficoPie {
  name: string;
  value: number;
}

type PeriodoRanking = "hoy" | "semana" | "mes" | "todo";

const PERIODOS_RANKING: { valor: PeriodoRanking; clave: string }[] = [
  { valor: "hoy", clave: "dashboard.periodo_hoy" },
  { valor: "semana", clave: "dashboard.periodo_semana" },
  { valor: "mes", clave: "dashboard.periodo_mes" },
  { valor: "todo", clave: "dashboard.periodo_todo" },
];

function dentroDePeriodo(fechaStr: string, periodo: PeriodoRanking): boolean {
  if (periodo === "todo") return true;

  const fecha = new Date(fechaStr);
  const ahora = new Date();

  if (periodo === "hoy") {
    return (
      fecha.getDate() === ahora.getDate() &&
      fecha.getMonth() === ahora.getMonth() &&
      fecha.getFullYear() === ahora.getFullYear()
    );
  }

  if (periodo === "semana") {
    const hace7dias = new Date(ahora);
    hace7dias.setDate(ahora.getDate() - 7);
    return fecha >= hace7dias && fecha <= ahora;
  }

  // mes
  return fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear();
}

// text-transform:capitalize pone en mayúscula CADA palabra ("Sábado, 18
// De Julio"); aquí solo se capitaliza la primera letra de la frase.
function capitalizarInicio(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function DashboardPremium() {
  const router = useRouter();
  const { tema, tipoTendencia, tipoDistribucion } = useTheme();
  const { t, idioma } = useIdioma();
  const { mostrarToast } = useToast();
  const { user, cargando: cargandoAuth } = useAuth();
  const { miembroActivo, puede, limpiarMiembroActivo } = useMiembroActivo();
  const { esEasy } = useModoInterfaz();
  const COLORES_PIE = obtenerPaletaGrafica(tema);

  // Estados analíticos de tarjetas
  const [ventasHoy, setVentasHoy] = useState<number>(0);
  const [ticketsHoy, setTicketsHoy] = useState<number>(0);
  const [ventasMes, setVentasMes] = useState<number>(0);
  const [totalProductos, setTotalProductos] = useState<number>(0);
  const [alertasStockCount, setAlertasStockCount] = useState<number>(0);
  const [cajaActual, setCajaActual] = useState<number>(0);
  
  // Listas de datos dinámicos
  const [ventasRecientes, setVentasRecientes] = useState<VentaReciente[]>([]);
  const [productosAlerta, setProductosAlerta] = useState<ProductoStockBajo[]>([]);

  // Todas las ventas (crudas) y el mapa de nombres de clientes, para
  // poder recalcular "Top artículos" y "Mejores clientes" según el
  // período elegido sin volver a consultar la base de datos.
  const [ventasTodas, setVentasTodas] = useState<VentaReciente[]>([]);
  const [nombresClientes, setNombresClientes] = useState<Map<number, string>>(new Map());

  // Cada tarjeta tiene su propio selector de período — son controles
  // independientes, no deben cambiar juntos al mover uno solo.
  const [periodoTopArticulos, setPeriodoTopArticulos] = useState<PeriodoRanking>("todo");
  const [periodoMejoresClientes, setPeriodoMejoresClientes] = useState<PeriodoRanking>("todo");

  // Estados para las gráficas reales
  const [dataLinea, setDataLinea] = useState<DataGraficoLinea[]>([]);

  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (cargandoAuth) return;

    if (!user) {
      router.push("/login");
      return;
    }

    cargarDatosDashboard(user.id);
  }, [cargandoAuth, user]);

  const ventasParaTopArticulos = useMemo(
    () => ventasTodas.filter((v) => dentroDePeriodo(v.fecha, periodoTopArticulos)),
    [ventasTodas, periodoTopArticulos]
  );

  const ventasParaMejoresClientes = useMemo(
    () => ventasTodas.filter((v) => dentroDePeriodo(v.fecha, periodoMejoresClientes)),
    [ventasTodas, periodoMejoresClientes]
  );

  const dataPie = useMemo<DataGraficoPie[]>(() => {
    const mapaProductos: { [key: string]: number } = {};

    ventasParaTopArticulos.forEach((v) => {
      if (v.producto) {
        mapaProductos[v.producto] = (mapaProductos[v.producto] || 0) + Number(v.total);
      }
    });

    return Object.keys(mapaProductos)
      .map((key) => ({ name: key, value: mapaProductos[key] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [ventasParaTopArticulos]);

  const mejoresClientes = useMemo<ClienteTop[]>(() => {
    const conCliente = ventasParaMejoresClientes.filter((v) => v.cliente_id != null);
    const mapaClientes = new Map<number, number>();

    conCliente.forEach((v) => {
      const id = v.cliente_id as number;
      mapaClientes.set(id, (mapaClientes.get(id) ?? 0) + Number(v.total));
    });

    return Array.from(mapaClientes.entries())
      .map(([id, total]) => ({
        nombre: nombresClientes.get(id) ?? t("dashboard.cliente_eliminado"),
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [ventasParaMejoresClientes, nombresClientes, t]);

  async function cargarDatosDashboard(userId: string) {
    try {
      // 1. OBTENER PRODUCTOS (Select corregido para TypeScript)
      const { data: productos, error: errorProductos } = await supabase
        .from("productos")
        .select("id, nombre, stock, stock_minimo")
        .eq("user_id", userId);

      if (errorProductos) throw errorProductos;

      if (productos) {
        setTotalProductos(productos.length);
        const productosTipados = productos as ProductoStockBajo[];
        const bajos = productosTipados.filter(p => p.stock <= (p.stock_minimo ?? 5));
        setProductosAlerta(bajos.slice(0, 4));
        setAlertasStockCount(bajos.length);
      }

      // 2. OBTENER VENTAS (Con tipado explícito)
      const { data: ventas, error: errorVentas } = await supabase
        .from("ventas")
        .select("*")
        .eq("user_id", userId);

      if (errorVentas) throw errorVentas;

      if (ventas) {
        const ventasTipadas = ventas as VentaReciente[];
        const ahora = new Date();

        // Filtrados base para tarjetas
        const hoyFiltradas = ventasTipadas.filter((v) => {
          const f = new Date(v.fecha);
          return f.getDate() === ahora.getDate() && f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
        });

        const mesFiltradas = ventasTipadas.filter((v) => {
          const f = new Date(v.fecha);
          return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
        });

        setVentasHoy(hoyFiltradas.reduce((sum, v) => sum + Number(v.total), 0));
        setTicketsHoy(hoyFiltradas.length);
        setVentasMes(mesFiltradas.reduce((sum, v) => sum + Number(v.total), 0));

        // Historial reciente ordenado cronológicamente
        const ordenadas = [...ventasTipadas].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        setVentasRecientes(ordenadas.slice(0, 4));

        // ==========================================
        // PROCESAMIENTO DE GRÁFICA DE LÍNEA (Historial 7 días)
        // ==========================================
        const mapaDias: { [key: string]: number } = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(ahora.getDate() - i);
          const label = d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
          mapaDias[label] = 0;
        }

        ventasTipadas.forEach((v) => {
          const f = new Date(v.fecha);
          const label = f.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
          if (mapaDias[label] !== undefined) {
            mapaDias[label] += Number(v.total);
          }
        });

        const formateadaLinea = Object.keys(mapaDias).map(key => ({
          fecha: key,
          monto: mapaDias[key]
        }));
        setDataLinea(formateadaLinea);

        // Se guardan crudas para poder recalcular "Top artículos" y
        // "Mejores clientes" cuando el usuario cambie el período,
        // sin volver a consultar la base de datos.
        setVentasTodas(ventasTipadas);

        const { data: clientes, error: errorClientes } = await supabase
          .from("clientes")
          .select("id, nombre")
          .eq("user_id", userId);

        if (errorClientes) throw errorClientes;

        setNombresClientes(
          new Map((clientes ?? []).map((c) => [c.id as number, c.nombre as string]))
        );
      }

      // Aparte y tolerante a fallos: si Caja todavía no tiene su
      // migración corrida en este proyecto, el resto del dashboard no
      // debe dejar de mostrarse por eso.
      try {
        const movimientos = await cargarMovimientos();
        setCajaActual(calcularSaldo(movimientos));
      } catch (errorCaja) {
        console.error(errorCaja);
      }
    } catch (error) {
      console.error("Error al poblar el Dashboard Premium:", error);
      mostrarToast(t("comun.msg_error_cargar_datos"), "error");
    } finally {
      setLoading(false);
    }
  }

  // ESTADO DE CARGA PREMIUM CORREGIDO (Mantiene la coherencia visual oscura)
  if (loading) {
    return (
      <div style={{
        display: "grid",
        placeItems: "center",
        height: "100dvh",
        color: "var(--text-primary)", 
        backgroundColor: "var(--bg-primary)", 
        fontFamily: "sans-serif",
        width: "100%"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "40px",
            height: "40px",
            border: "3px solid rgba(89, 69, 228, 0.1)",
            borderTop: "3px solid var(--primary)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 16px auto"
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", letterSpacing: "0.05em", margin: 0 }}>
            {t("dashboard.cargando")}
          </p>
        </div>
      </div>
    );
  }

  async function cerrarSesionMiembro() {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error(error);
    } finally {
      limpiarMiembroActivo();
      window.location.href = "/login";
    }
  }

  // Un miembro del equipo ve una versión simple del dashboard en vez
  // del panel de análisis completo: solo accesos directos a los
  // módulos que le tocan (Caja, Ventas si tiene permiso, Productos) y
  // una forma de cerrar sesión, sin pasar por Configuración.
  if (miembroActivo) {
    return (
      <div style={{ padding: "24px", color: "var(--text-primary)", fontFamily: "sans-serif", backgroundColor: "var(--bg-primary)", minHeight: "100dvh", width: "100%" }}>
        <header className="dashboard-simple-saludo">
          <h1 style={{ fontSize: "24px", fontWeight: "700", margin: 0, letterSpacing: "-0.02em" }}>
            {t("dashboard.saludo")}, {miembroActivo.nombre} 👋
          </h1>
          <p
            suppressHydrationWarning
            style={{ color: "var(--text-secondary)", fontSize: "13px", margin: "4px 0 0 0" }}
          >
            {capitalizarInicio(
              new Date().toLocaleDateString(LOCALES[idioma], {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            )}
          </p>
        </header>

        <div className="dashboard-simple-tiles">
          <Link href="/caja" className="dashboard-simple-tile">
            <span className="dashboard-simple-tile-icono" style={{ background: "#84cc16" }}>
              <Inbox size={26} color="#fff" />
            </span>
            {t("sidebar.caja")}
          </Link>

          {puede("ver_ventas") && (
            <Link href="/ventas" className="dashboard-simple-tile">
              <span className="dashboard-simple-tile-icono" style={{ background: "#10b981" }}>
                <DollarSign size={26} color="#fff" />
              </span>
              {t("sidebar.ventas")}
            </Link>
          )}

          <Link href="/productos" className="dashboard-simple-tile">
            <span className="dashboard-simple-tile-icono" style={{ background: "#22c55e" }}>
              <Package size={26} color="#fff" />
            </span>
            {t("sidebar.productos")}
          </Link>
        </div>

        <button className="dashboard-simple-salir" onClick={cerrarSesionMiembro}>
          <LogOut size={14} /> {t("header.cerrar_sesion")}
        </button>
      </div>
    );
  }

  if (esEasy) {
    return (
      <DashboardEasy
        ventasHoy={ventasHoy}
        ticketsHoy={ticketsHoy}
        cajaActual={cajaActual}
        productosBajos={alertasStockCount}
      />
    );
  }

  return (
    <div style={{ padding: "12px 24px 24px 24px", color: "var(--text-primary)", fontFamily: "sans-serif", backgroundColor: "var(--bg-primary)", minHeight: "100dvh", width: "100%" }}>

      {/* SECCIÓN SUPERIOR: ENCABEZADO */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", margin: 0, letterSpacing: "-0.02em" }}>
            {t("dashboard.saludo")}
            {user?.email ? `, ${user.email.split("@")[0]}` : ""} 👋
          </h1>
          <p
            suppressHydrationWarning
            style={{ color: "var(--text-secondary)", fontSize: "13px", margin: "4px 0 0 0" }}
          >
            {capitalizarInicio(
              new Date().toLocaleDateString(LOCALES[idioma], {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            )}
          </p>
        </div>

        <Link
          href="/ventas-rapidas"
          className="btn-primary dashboard-venta-rapida-btn"
          style={{ alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}
        >
          <Zap size={16} /> {t("ventas_rapidas.titulo")}
        </Link>
      </header>

      {/* METRIC CARDS: GRID ASIMÉTRICO */}
      <section className="dashboard-hero-grid" style={{ marginBottom: "28px" }}>
        {/* TARJETA HÉROE: VENTAS DE HOY, con sparkline */}
        <div
          className="dashboard-card-hero"
          style={{
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: COLORES_PIE[0], display: "grid", placeItems: "center" }}>
                <DollarSign size={19} color="#fff" />
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "12.5px", fontWeight: "600", textTransform: "uppercase", margin: 0 }}>{t("dashboard.ventas_hoy")}</p>
            </div>
            <h2 style={{ fontSize: "34px", fontWeight: "700", margin: "0 0 6px 0", color: "var(--text-primary)" }}>
              $<ContadorAnimado valor={ventasHoy} decimales={2} />
            </h2>
            <span style={{ color: "#10b981", fontSize: "12.5px" }}>▲ {t("dashboard.tiempo_real")}</span>
          </div>

          <div style={{ width: "100%", height: "70px", marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataLinea} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sparkHoy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORES_PIE[0]} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={COLORES_PIE[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="monto" stroke={COLORES_PIE[0]} strokeWidth={2} fill="url(#sparkHoy)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* VENTAS DEL MES, con sparkline */}
        <div
          className="dashboard-card-mes"
          style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            {/* Color fijo (ver comentario en la tarjeta "Productos en
                catálogo" más abajo): COLORES_PIE[1] es pastel en varios
                temas y el ícono blanco quedaba casi invisible encima. */}
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "#3b82f6", display: "grid", placeItems: "center" }}>
              <CalendarDays size={18} color="#fff" />
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", margin: 0 }}>{t("dashboard.ventas_mes")}</p>
          </div>
          <h2 style={{ fontSize: "26px", fontWeight: "700", margin: "0 0 6px 0", color: "var(--text-primary)" }}>
            $<ContadorAnimado valor={ventasMes} decimales={2} />
          </h2>
          <span style={{ color: "#10b981", fontSize: "12px" }}>▲ {t("dashboard.acumulado_bruto")}</span>

          <div style={{ width: "100%", height: "40px", marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataLinea} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sparkMes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORES_PIE[1]} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={COLORES_PIE[1]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="monto" stroke={COLORES_PIE[1]} strokeWidth={2} fill="url(#sparkMes)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PRODUCTOS EN CATÁLOGO */}
        <div
          className="dashboard-card-prod"
          style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            {/* Color fijo, no de la paleta rotativa: en varios temas
                (green, purple, amber, slate, cyan, sunset...) el tercer
                color de COLORES_PIE es un tono pastel muy claro, y el
                ícono blanco encima quedaba casi invisible. */}
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "#22c55e", display: "grid", placeItems: "center" }}>
              <Package size={18} color="#fff" />
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", margin: 0 }}>{t("dashboard.productos_catalogo")}</p>
          </div>
          <h2 style={{ fontSize: "26px", fontWeight: "700", margin: "0 0 6px 0", color: "var(--text-primary)" }}>
            <ContadorAnimado valor={totalProductos} decimales={0} />
          </h2>
          <span style={{ color: "#22c55e", fontSize: "12px" }}>● {t("dashboard.items_activos")}</span>
        </div>

        {/* ALERTAS DE STOCK (se mantiene en rojo/neutro: es una señal universal, no de marca) */}
        <div
          className="dashboard-card-alertas"
          style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: alertasStockCount > 0 ? "#ef4444" : "#61667a", display: "grid", placeItems: "center" }}>
              <AlertTriangle size={18} color="#fff" />
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", margin: 0 }}>{t("dashboard.alertas_stock")}</p>
          </div>
          <h2 style={{ fontSize: "26px", fontWeight: "700", margin: "0 0 6px 0", color: alertasStockCount > 0 ? "#ef4444" : "var(--text-primary)" }}>
            <ContadorAnimado valor={alertasStockCount} decimales={0} />
          </h2>
          <span style={{ color: alertasStockCount > 0 ? "#ef4444" : "var(--text-secondary)", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: 5 }}>
            {alertasStockCount > 0 ? (
              <>
                <AlertTriangle size={12} /> {t("dashboard.requiere_atencion")}
              </>
            ) : (
              <>
                <CheckCircle2 size={12} /> {t("dashboard.inventario_optimo")}
              </>
            )}
          </span>
        </div>
      </section>

      {/* BLOCK CENTRAL DE GRÁFICAS INTERACTIVAS */}
      <section className="dashboard-2fr-1fr" style={{ marginBottom: "28px" }}>
        
        {/* GRÁFICO A: TENDENCIA DE VENTAS */}
        <div style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 20px 0" }}>{t("dashboard.rendimiento_ingresos")}</h3>
          <div style={{ width: "100%", height: "260px" }}>
            <ResponsiveContainer width="100%" height="100%">
              {tipoTendencia === "barras" ? (
                <BarChart data={dataLinea} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="fecha" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(valor) =>
                      valor >= 1000
                        ? `${(valor / 1000).toFixed(0)}k`
                        : String(valor)
                    }
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "8px" }}
                    labelStyle={{ color: "var(--text-secondary)", fontSize: "12px" }}
                    itemStyle={{ color: "var(--text-primary)", fontSize: "13px" }}
                    formatter={(valor) => formatoMoneda(Number(valor))}
                  />
                  <Bar dataKey="monto" name={t("dashboard.total_ventas_serie")} fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : tipoTendencia === "linea" ? (
                <LineChart data={dataLinea} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="fecha" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(valor) =>
                      valor >= 1000
                        ? `${(valor / 1000).toFixed(0)}k`
                        : String(valor)
                    }
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "8px" }}
                    labelStyle={{ color: "var(--text-secondary)", fontSize: "12px" }}
                    itemStyle={{ color: "var(--text-primary)", fontSize: "13px" }}
                    formatter={(valor) => formatoMoneda(Number(valor))}
                  />
                  <Line type="monotone" dataKey="monto" name={t("dashboard.total_ventas_serie")} stroke="var(--primary)" strokeWidth={2.5} dot={false} />
                </LineChart>
              ) : tipoTendencia === "velas" ? (
                <BarChart data={dataLinea} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="fecha" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(valor) =>
                      valor >= 1000
                        ? `${(valor / 1000).toFixed(0)}k`
                        : String(valor)
                    }
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "8px" }}
                    labelStyle={{ color: "var(--text-secondary)", fontSize: "12px" }}
                    itemStyle={{ color: "var(--text-primary)", fontSize: "13px" }}
                    formatter={(valor) => formatoMoneda(Number(valor))}
                  />
                  <Bar dataKey="monto" name={t("dashboard.total_ventas_serie")} radius={[3, 3, 3, 3]}>
                    {dataLinea.map((punto, index) => {
                      const anterior = index > 0 ? dataLinea[index - 1].monto : punto.monto;
                      const sube = punto.monto >= anterior;
                      return <Cell key={`vela-${index}`} fill={sube ? "#10b981" : "#ef4444"} />;
                    })}
                  </Bar>
                </BarChart>
              ) : (
                <AreaChart data={dataLinea} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMonto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="fecha" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(valor) =>
                      valor >= 1000
                        ? `${(valor / 1000).toFixed(0)}k`
                        : String(valor)
                    }
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "8px" }}
                    labelStyle={{ color: "var(--text-secondary)", fontSize: "12px" }}
                    itemStyle={{ color: "var(--text-primary)", fontSize: "13px" }}
                    formatter={(valor) => formatoMoneda(Number(valor))}
                  />
                  <Area type="monotone" dataKey="monto" name={t("dashboard.total_ventas_serie")} stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorMonto)" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRÁFICO B: DISTRIBUCIÓN DE PARTICIPACIÓN */}
        <div style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>{t("dashboard.top_articulos")}</h3>
            <SelectorPersonalizado
              value={periodoTopArticulos}
              onChange={(v) => setPeriodoTopArticulos(v as PeriodoRanking)}
              style={{ width: "auto", fontSize: 12, padding: "6px 10px" }}
            >
              {PERIODOS_RANKING.map((p) => (
                <OpcionSelector key={p.valor} value={p.valor}>
                  {t(p.clave)}
                </OpcionSelector>
              ))}
            </SelectorPersonalizado>
          </div>
          <div style={{ width: "100%", height: "220px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {dataPie.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{t("dashboard.sin_datos")}</p>
            ) : tipoDistribucion === "barras" ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataPie} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={90}
                    tickFormatter={(valor: string) => (valor.length > 12 ? `${valor.substring(0, 12)}...` : valor)}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "8px" }}
                    itemStyle={{ color: "var(--text-primary)", fontSize: "12px" }}
                    formatter={(valor) => formatoMoneda(Number(valor))}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {dataPie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORES_PIE[index % COLORES_PIE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {dataPie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORES_PIE[index % COLORES_PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "8px" }}
                    itemStyle={{ color: "var(--text-primary)", fontSize: "12px" }}
                    formatter={(valor) => formatoMoneda(Number(valor))}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {tipoDistribucion !== "barras" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", marginTop: "10px" }}>
              {dataPie.map((item, idx) => (
                <div key={item.name} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: COLORES_PIE[idx % COLORES_PIE.length] }}></div>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                    {item.name.length > 10 ? `${item.name.substring(0, 10)}...` : item.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </section>

      {/* REJILLA INFERIOR: TABLA DE VENTAS RECIENTES + ALERTAS */}
      <section className="dashboard-2fr-1fr">
        
        {/* TABLA DE VENTAS */}
        <div style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 20px 0" }}>{t("dashboard.ventas_recientes")}</h3>
          <div className="dashboard-tabla-mini-wrap" style={{ overflowX: "auto" }}>
            <table className="dashboard-tabla-mini" style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: "12px 8px", fontWeight: "500" }}>{t("tabla.producto")}</th>
                  <th style={{ padding: "12px 8px", fontWeight: "500" }}>{t("tabla.cantidad")}</th>
                  <th style={{ padding: "12px 8px", fontWeight: "500" }}>{t("tabla.total")}</th>
                  <th style={{ padding: "12px 8px", fontWeight: "500" }}>{t("tabla.fecha")}</th>
                </tr>
              </thead>
              <tbody>
                {ventasRecientes.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "32px 0" }}>{t("dashboard.sin_transacciones")}</td>
                  </tr>
                ) : (
                  ventasRecientes.map((venta) => (
                    <tr key={venta.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="dashboard-tabla-mini-producto" style={{ padding: "14px 8px", fontWeight: "500" }}>{venta.producto}</td>
                      <td style={{ padding: "14px 8px", color: "var(--text-secondary)" }}>{venta.cantidad} {t("tabla.unidades_abrev")}</td>
                      <td style={{ padding: "14px 8px", fontWeight: "600", color: "#10b981" }}>{formatoMoneda(Number(venta.total))}</td>
                      <td style={{ padding: "14px 8px", color: "var(--text-secondary)" }}>
                        {new Date(venta.fecha).toLocaleDateString("es-MX", { day: "numeric", month: "numeric" })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* COMPONENTE ALERTAS DE STOCK CRÍTICO */}
        <div style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 4px 0" }}>{t("dashboard.alertas_stock_bajo")}</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "12px", margin: "0 0 20px 0" }}>{t("dashboard.articulos_criticos")}</p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {productosAlerta.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center", padding: "40px 0", color: "#10b981", fontSize: "13px", border: "1px dashed var(--border)", borderRadius: "10px" }}>
                <CheckCircle2 size={15} /> {t("dashboard.sin_inventario_bajo")}
              </div>
            ) : (
              productosAlerta.map((prod) => (
                <div key={prod.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "10px" }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "500" }}>{prod.nombre}</h4>
                    <span style={{ fontSize: "12px", color: "#ef4444", fontWeight: "500" }}>{t("dashboard.stock_actual")}: {prod.stock}</span>
                  </div>
                  <span style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>{t("dashboard.critico")}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </section>

      {/* MEJORES CLIENTES */}
      <section style={{ marginTop: "24px" }}>
        <div style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 4px 0" }}>{t("dashboard.mejores_clientes")}</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "12px", margin: "0 0 20px 0" }}>{t("dashboard.mejores_clientes_desc")}</p>
            </div>
            <SelectorPersonalizado
              value={periodoMejoresClientes}
              onChange={(v) => setPeriodoMejoresClientes(v as PeriodoRanking)}
              style={{ width: "auto", fontSize: 12, padding: "6px 10px" }}
            >
              {PERIODOS_RANKING.map((p) => (
                <OpcionSelector key={p.valor} value={p.valor}>
                  {t(p.clave)}
                </OpcionSelector>
              ))}
            </SelectorPersonalizado>
          </div>

          {mejoresClientes.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{t("dashboard.sin_datos")}</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              {mejoresClientes.map((cliente, i) => (
                <div
                  key={cliente.nombre + i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "grid",
                      placeItems: "center",
                      background: COLORES_PIE[i % COLORES_PIE.length],
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: "13.5px",
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cliente.nombre}
                    </h4>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {formatoMoneda(cliente.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}