"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
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
}

interface ProductoStockBajo {
  id: number;
  nombre: string;
  stock: number;
}

interface DataGraficoLinea {
  fecha: string;
  monto: number;
}

interface DataGraficoPie {
  name: string;
  value: number;
}

const COLORES_PIE = ["#5945e4", "#8b5cf6", "#a78bfa", "#10b981", "#059669", "#3b82f6"];

export default function DashboardPremium() {
  const router = useRouter();
  
  // Estados analíticos de tarjetas
  const [ventasHoy, setVentasHoy] = useState<number>(0);
  const [ventasMes, setVentasMes] = useState<number>(0);
  const [totalProductos, setTotalProductos] = useState<number>(0);
  const [alertasStockCount, setAlertasStockCount] = useState<number>(0);
  
  // Listas de datos dinámicos
  const [ventasRecientes, setVentasRecientes] = useState<VentaReciente[]>([]);
  const [productosAlerta, setProductosAlerta] = useState<ProductoStockBajo[]>([]);
  
  // Estados para las gráficas reales
  const [dataLinea, setDataLinea] = useState<DataGraficoLinea[]>([]);
  const [dataPie, setDataPie] = useState<DataGraficoPie[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    cargarDatosDashboard();
  }, []);

  async function cargarDatosDashboard() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // 1. OBTENER PRODUCTOS (Select corregido para TypeScript)
      const { data: productos } = await supabase
        .from("productos")
        .select("id, nombre, stock")
        .eq("user_id", user.id);

      if (productos) {
        setTotalProductos(productos.length);
        const productosTipados = productos as ProductoStockBajo[];
        const bajos = productosTipados.filter(p => p.stock <= 5);
        setProductosAlerta(bajos.slice(0, 4));
        setAlertasStockCount(bajos.length);
      }

      // 2. OBTENER VENTAS (Con tipado explícito)
      const { data: ventas } = await supabase
        .from("ventas")
        .select("*")
        .eq("user_id", user.id);

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

        // ==========================================
        // PROCESAMIENTO DE GRÁFICA DE PIE (Top 5 Productos)
        // ==========================================
        const mapaProductos: { [key: string]: number } = {};
        ventasTipadas.forEach((v) => {
          if (v.producto) {
            mapaProductos[v.producto] = (mapaProductos[v.producto] || 0) + Number(v.total);
          }
        });

        const formateadaPie = Object.keys(mapaProductos).map(key => ({
          name: key,
          value: mapaProductos[key]
        })).sort((a, b) => b.value - a.value).slice(0, 5);

        setDataPie(formateadaPie);
      }

    } catch (error) {
      console.error("Error al poblar el Dashboard Premium:", error);
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
        height: "100vh", 
        color: "#ffffff", 
        backgroundColor: "#090a14", 
        fontFamily: "sans-serif",
        width: "100%"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "40px",
            height: "40px",
            border: "3px solid rgba(89, 69, 228, 0.1)",
            borderTop: "3px solid #5945e4",
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
          <p style={{ fontSize: "14px", color: "#61667a", letterSpacing: "0.05em", margin: 0 }}>
            Construyendo interfaz analítica...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 24px 24px 24px", color: "#ffffff", fontFamily: "sans-serif", backgroundColor: "#090a14", minHeight: "100vh", width: "100%" }}>
      
      {/* SECCIÓN SUPERIOR: ENCABEZADO */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", margin: 0, letterSpacing: "-0.02em" }}>Dashboard</h1>
          <p style={{ color: "#61667a", fontSize: "13px", margin: "4px 0 0 0" }}>Resumen analítico en tiempo real conectado a Supabase</p>
        </div>
      </header>

      {/* METRIC CARDS GRID */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "28px" }}>
        <div style={{ backgroundColor: "#121424", border: "1px solid #1c1f3b", borderRadius: "14px", padding: "20px" }}>
          <p style={{ color: "#61667a", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", margin: 0 }}>Ventas de hoy</p>
          <h2 style={{ fontSize: "26px", fontWeight: "700", margin: "10px 0 6px 0" }}>${ventasHoy.toLocaleString("en-US", { minimumFractionDigits: 2 })}</h2>
          <span style={{ color: "#10b981", fontSize: "12px" }}>▲ En tiempo real</span>
        </div>

        <div style={{ backgroundColor: "#121424", border: "1px solid #1c1f3b", borderRadius: "14px", padding: "20px" }}>
          <p style={{ color: "#61667a", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", margin: 0 }}>Ventas del mes</p>
          <h2 style={{ fontSize: "26px", fontWeight: "700", margin: "10px 0 6px 0" }}>${ventasMes.toLocaleString("en-US", { minimumFractionDigits: 2 })}</h2>
          <span style={{ color: "#10b981", fontSize: "12px" }}>▲ Acumulado bruto</span>
        </div>

        <div style={{ backgroundColor: "#121424", border: "1px solid #1c1f3b", borderRadius: "14px", padding: "20px" }}>
          <p style={{ color: "#61667a", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", margin: 0 }}>Productos en Catálogo</p>
          <h2 style={{ fontSize: "26px", fontWeight: "700", margin: "10px 0 6px 0" }}>{totalProductos}</h2>
          <span style={{ color: "#3b82f6", fontSize: "12px" }}>● Items activos</span>
        </div>

        <div style={{ backgroundColor: "#121424", border: "1px solid #1c1f3b", borderRadius: "14px", padding: "20px" }}>
          <p style={{ color: "#61667a", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", margin: 0 }}>Alertas de stock</p>
          <h2 style={{ fontSize: "26px", fontWeight: "700", margin: "10px 0 6px 0", color: alertasStockCount > 0 ? "#ef4444" : "#ffffff" }}>{alertasStockCount}</h2>
          <span style={{ color: alertasStockCount > 0 ? "#ef4444" : "#61667a", fontSize: "12px" }}>{alertasStockCount > 0 ? "⚠️ Requiere atención" : "✓ Inventario óptimo"}</span>
        </div>
      </section>

      {/* BLOCK CENTRAL DE GRÁFICAS INTERACTIVAS */}
      <section style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", marginBottom: "28px" }}>
        
        {/* GRÁFICO A: TENDENCIA DE VENTAS */}
        <div style={{ backgroundColor: "#121424", border: "1px solid #1c1f3b", borderRadius: "14px", padding: "24px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 20px 0" }}>Rendimiento de Ingresos (Últimos días)</h3>
          <div style={{ width: "100%", height: "260px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataLinea} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMonto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5945e4" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#5945e4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="fecha" stroke="#4e5264" fontSize={11} tickLine={false} />
                <YAxis stroke="#4e5264" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0c0d16", border: "1px solid #1c1f3b", borderRadius: "8px" }}
                  labelStyle={{ color: "#61667a", fontSize: "12px" }}
                  itemStyle={{ color: "#ffffff", fontSize: "13px" }}
                />
                <Area type="monotone" dataKey="monto" name="Total Ventas" stroke="#5945e4" strokeWidth={2} fillOpacity={1} fill="url(#colorMonto)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRÁFICO B: DISTRIBUCIÓN DE PARTICIPACIÓN */}
        <div style={{ backgroundColor: "#121424", border: "1px solid #1c1f3b", borderRadius: "14px", padding: "24px", display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 10px 0" }}>Top Artículos</h3>
          <div style={{ width: "100%", height: "200px", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {dataPie.length === 0 ? (
              <p style={{ color: "#61667a", fontSize: "13px" }}>Sin datos suficientes</p>
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
                    contentStyle={{ backgroundColor: "#0c0d16", border: "1px solid #1c1f3b", borderRadius: "8px" }}
                    itemStyle={{ color: "#ffffff", fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", marginTop: "10px" }}>
            {dataPie.map((item, idx) => (
              <div key={item.name} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: COLORES_PIE[idx % COLORES_PIE.length] }}></div>
                <span style={{ fontSize: "11px", color: "#cbd5e1" }}>{item.name.substring(0, 10)}...</span>
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* REJILLA INFERIOR: TABLA DE VENTAS RECIENTES + ALERTAS */}
      <section style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", alignItems: "start" }}>
        
        {/* TABLA DE VENTAS */}
        <div style={{ backgroundColor: "#121424", border: "1px solid #1c1f3b", borderRadius: "14px", padding: "24px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 20px 0" }}>Ventas recientes</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ color: "#61667a", borderBottom: "1px solid #1c1f3b", textAlign: "left" }}>
                  <th style={{ padding: "12px 8px", fontWeight: "500" }}>Producto</th>
                  <th style={{ padding: "12px 8px", fontWeight: "500" }}>Cantidad</th>
                  <th style={{ padding: "12px 8px", fontWeight: "500" }}>Total</th>
                  <th style={{ padding: "12px 8px", fontWeight: "500" }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {ventasRecientes.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "#61667a", padding: "32px 0" }}>No hay transacciones recientes en el historial.</td>
                  </tr>
                ) : (
                  ventasRecientes.map((venta) => (
                    <tr key={venta.id} style={{ borderBottom: "1px solid #16182c" }}>
                      <td style={{ padding: "14px 8px", fontWeight: "500" }}>{venta.producto}</td>
                      <td style={{ padding: "14px 8px", color: "#cbd5e1" }}>{venta.cantidad} uds.</td>
                      <td style={{ padding: "14px 8px", fontWeight: "600", color: "#10b981" }}>${Number(venta.total).toFixed(2)}</td>
                      <td style={{ padding: "14px 8px", color: "#61667a" }}>{new Date(venta.fecha).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* COMPONENTE ALERTAS DE STOCK CRÍTICO */}
        <div style={{ backgroundColor: "#121424", border: "1px solid #1c1f3b", borderRadius: "14px", padding: "24px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 4px 0" }}>Alertas de stock bajo</h3>
          <p style={{ color: "#61667a", fontSize: "12px", margin: "0 0 20px 0" }}>Artículos con existencia crítica (≤ 5 unidades)</p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {productosAlerta.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#10b981", fontSize: "13px", border: "1px dashed #1c1f3b", borderRadius: "10px" }}>
                ✓ No tienes productos con inventario bajo.
              </div>
            ) : (
              productosAlerta.map((prod) => (
                <div key={prod.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", backgroundColor: "#0c0d16", border: "1px solid #16182c", borderRadius: "10px" }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "500" }}>{prod.nombre}</h4>
                    <span style={{ fontSize: "12px", color: "#ef4444", fontWeight: "500" }}>Stock actual: {prod.stock}</span>
                  </div>
                  <span style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>Crítico</span>
                </div>
              ))
            )}
          </div>
        </div>

      </section>

    </div>
  );
}