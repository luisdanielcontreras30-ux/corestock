"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, Trash2 } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { Producto, AjusteStock } from "./types";
import { cargarDatos, registrarAjuste, eliminarAjuste } from "./acciones";

type Tipo = "agregar" | "quitar";

export default function AjustesStockPage() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();

  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ajustes, setAjustes] = useState<AjusteStock[]>([]);

  const [productoId, setProductoId] = useState("");
  const [tipo, setTipo] = useState<Tipo>("agregar");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function obtenerDatos() {
    setLoading(true);
    try {
      const datos = await cargarDatos();
      setProductos(datos.productos);
      setAjustes(datos.ajustes);
    } catch (error) {
      console.error(error);
      alert(t("comun.msg_error_cargar_datos"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (cargandoAuth) return;

    if (!user) {
      router.push("/login");
      return;
    }

    obtenerDatos();
  }, [cargandoAuth, user]);

  const producto = productos.find((p) => p.id === Number(productoId));
  const cantidadNum = Number(cantidad) || 0;

  function limpiar() {
    setProductoId("");
    setTipo("agregar");
    setCantidad("");
    setMotivo("");
  }

  async function guardar() {
    if (guardando) return;

    if (!producto) {
      alert(t("ajustes_stock.msg_selecciona_producto"));
      return;
    }

    if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
      alert(t("ajustes_stock.msg_cantidad_mayor"));
      return;
    }

    const delta = tipo === "agregar" ? cantidadNum : -cantidadNum;

    if (tipo === "quitar" && cantidadNum > producto.stock) {
      alert(t("ajustes_stock.msg_sin_stock"));
      return;
    }

    try {
      setGuardando(true);
      await registrarAjuste(producto, delta, motivo);

      limpiar();
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = error instanceof Error ? error.message : "";
      alert(detalle || t("ajustes_stock.msg_error_guardar"));
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id: number) {
    if (!confirm(t("ajustes_stock.confirmar_eliminar"))) return;

    try {
      await eliminarAjuste(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(t("ajustes_stock.msg_error_eliminar"));
    }
  }

  if (cargandoAuth || !user || loading) {
    return (
      <main className="fade-up">
        <div className="card">{t("header.cargando")}</div>
      </main>
    );
  }

  return (
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 34, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
          <SlidersHorizontal size={28} /> {t("sidebar.ajustes_stock")}
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>{t("ajustes_stock.subtitulo")}</p>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{t("ajustes_stock.registrar")}</h2>

        <div className="productos-grid">
          <select value={productoId} onChange={(e) => setProductoId(e.target.value)}>
            <option value="">{t("ajustes_stock.selecciona_producto")}</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — {t("dashboard.stock_actual")}: {p.stock}
              </option>
            ))}
          </select>

          <select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
            <option value="agregar">{t("ajustes_stock.tipo_agregar")}</option>
            <option value="quitar">{t("ajustes_stock.tipo_quitar")}</option>
          </select>

          <input
            type="number"
            min="1"
            step="1"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder={t("tabla.cantidad")}
          />

          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={t("ajustes_stock.motivo_placeholder")}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? t("compras.guardando") : t("ajustes_stock.registrar")}
          </button>
        </div>
      </div>

      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>{t("tabla.fecha")}</th>
              <th>{t("tabla.producto")}</th>
              <th>{t("ajustes_stock.col_cambio")}</th>
              <th>{t("ajustes_stock.col_stock_resultante")}</th>
              <th>{t("ajustes_stock.col_motivo")}</th>
              <th>{t("productos.col_acciones")}</th>
            </tr>
          </thead>

          <tbody>
            {ajustes.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  {t("ajustes_stock.sin_ajustes")}
                </td>
              </tr>
            ) : (
              ajustes.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.fecha).toLocaleDateString()}</td>
                  <td>{a.producto}</td>
                  <td
                    style={{
                      fontWeight: 700,
                      color: a.cantidad_ajuste >= 0 ? "#10b981" : "#ef4444",
                    }}
                  >
                    {a.cantidad_ajuste >= 0 ? "+" : ""}
                    {a.cantidad_ajuste}
                  </td>
                  <td>{a.stock_nuevo}</td>
                  <td>{a.motivo || "—"}</td>
                  <td>
                    <button
                      className="btn-delete"
                      aria-label={t("productos.eliminar")}
                      onClick={() => borrar(a.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
