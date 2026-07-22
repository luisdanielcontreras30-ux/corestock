"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, Trash2 } from "lucide-react";
import { mensajeErrorSeguro } from "../../lib/errores";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import SelectorPersonalizado, { OpcionSelector } from "../../components/SelectorPersonalizado";
import { Producto, AjusteStock } from "./types";
import { cargarDatos, registrarAjuste, eliminarAjuste } from "./acciones";

type Tipo = "agregar" | "quitar";

export default function AjustesStockPage() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ajustes, setAjustes] = useState<AjusteStock[]>([]);

  const [productoId, setProductoId] = useState("");
  const [tipo, setTipo] = useState<Tipo>("agregar");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  // acciones.ts lanza sentinels sin traducir (ver comentario en
  // lib/errores.ts) para los casos donde sí hay un mensaje pensado
  // para mostrarse — esta función los traduce; null si el error no es
  // ninguno de los esperados (deja pasar a mensajeErrorSeguro/fallback).
  function mensajeAjuste(error: unknown): string | null {
    if (!(error instanceof Error)) return null;
    switch (error.message) {
      case "SIN_STOCK":
        return t("ajustes_stock.msg_sin_stock");
      case "STOCK_CAMBIO":
        return t("comun.msg_stock_cambio");
      default:
        return null;
    }
  }

  async function obtenerDatos() {
    setLoading(true);
    setError(false);
    try {
      const datos = await cargarDatos();
      setProductos(datos.productos);
      setAjustes(datos.ajustes);
    } catch (error) {
      console.error(error);
      setError(true);
      mostrarToast(t("comun.msg_error_cargar_datos"), "error");
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
      mostrarToast(t("ajustes_stock.msg_selecciona_producto"), "error");
      return;
    }

    if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
      mostrarToast(t("ajustes_stock.msg_cantidad_mayor"), "error");
      return;
    }

    if (!Number.isInteger(cantidadNum)) {
      mostrarToast(t("comun.msg_cantidad_entera"), "error");
      return;
    }

    const delta = tipo === "agregar" ? cantidadNum : -cantidadNum;

    if (tipo === "quitar" && cantidadNum > producto.stock) {
      mostrarToast(t("ajustes_stock.msg_sin_stock"), "error");
      return;
    }

    try {
      setGuardando(true);
      await registrarAjuste(producto, delta, motivo);

      limpiar();
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = mensajeAjuste(error) || mensajeErrorSeguro(error);
      mostrarToast(detalle || t("ajustes_stock.msg_error_guardar"), "error");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id: number) {
    if (!(await confirmar(t("ajustes_stock.confirmar_eliminar"), { peligroso: true }))) return;

    try {
      await eliminarAjuste(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = mensajeAjuste(error) || mensajeErrorSeguro(error);
      mostrarToast(`${t("ajustes_stock.msg_error_eliminar")}${detalle ? ": " + detalle : ""}`, "error");
    }
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
        Icono={SlidersHorizontal}
        color="#0ea5e9"
        titulo={t("sidebar.ajustes_stock")}
        subtitulo={t("ajustes_stock.subtitulo")}
      />

      {loading ? (
        <div className="card">{t("header.cargando")}</div>
      ) : error ? (
        <div className="card" style={{ textAlign: "center", padding: "50px 20px" }}>
          <p style={{ color: "#ef4444", marginBottom: 14 }}>{t("comun.msg_error_cargar_datos")}</p>
          <button className="btn-primary" onClick={obtenerDatos}>
            {t("empresa.reintentar")}
          </button>
        </div>
      ) : (
      <>
      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{t("ajustes_stock.registrar")}</h2>

        <div className="productos-grid">
          <SelectorPersonalizado value={productoId} onChange={setProductoId}>
            <OpcionSelector value="">{t("ajustes_stock.selecciona_producto")}</OpcionSelector>
            {productos.map((p) => (
              <OpcionSelector key={p.id} value={p.id}>
                {p.nombre} — {t("dashboard.stock_actual")}: {p.stock}
              </OpcionSelector>
            ))}
          </SelectorPersonalizado>

          <SelectorPersonalizado value={tipo} onChange={(v) => setTipo(v as Tipo)}>
            <OpcionSelector value="agregar">{t("ajustes_stock.tipo_agregar")}</OpcionSelector>
            <OpcionSelector value="quitar">{t("ajustes_stock.tipo_quitar")}</OpcionSelector>
          </SelectorPersonalizado>

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
      </>
      )}
    </main>
  );
}
