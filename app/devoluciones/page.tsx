"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { mensajeErrorSeguro } from "../../lib/errores";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import SelectorPersonalizado, { OpcionSelector } from "../../components/SelectorPersonalizado";
import { Producto, Devolucion } from "./types";
import { cargarDatos, registrarDevolucion, eliminarDevolucion } from "./acciones";
import { formatoMoneda } from "../ventas/utils";

export default function DevolucionesPage() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);

  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [montoReembolsado, setMontoReembolsado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [reponerStock, setReponerStock] = useState(true);
  const [guardando, setGuardando] = useState(false);

  async function obtenerDatos() {
    setLoading(true);
    setError(false);
    try {
      const datos = await cargarDatos();
      setProductos(datos.productos);
      setDevoluciones(datos.devoluciones);
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
  const montoNum = montoReembolsado === "" ? 0 : Number(montoReembolsado);

  function limpiar() {
    setProductoId("");
    setCantidad("");
    setMontoReembolsado("");
    setMotivo("");
    setReponerStock(true);
  }

  async function guardar() {
    if (guardando) return;

    if (!producto) {
      mostrarToast(t("devoluciones.msg_selecciona_producto"), "error");
      return;
    }

    if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
      mostrarToast(t("devoluciones.msg_cantidad_mayor"), "error");
      return;
    }

    if (!Number.isInteger(cantidadNum)) {
      mostrarToast(t("comun.msg_cantidad_entera"), "error");
      return;
    }

    if (!Number.isFinite(montoNum) || montoNum < 0) {
      mostrarToast(t("devoluciones.msg_monto_invalido"), "error");
      return;
    }

    try {
      setGuardando(true);
      await registrarDevolucion(producto, cantidadNum, montoNum, motivo, reponerStock);

      limpiar();
      await obtenerDatos();
      mostrarToast(t("devoluciones.msg_registrada"), "exito");
    } catch (error) {
      console.error(error);
      const detalle = mensajeErrorSeguro(error);
      mostrarToast(detalle || t("devoluciones.msg_error_guardar"), "error");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(devolucion: Devolucion) {
    if (!(await confirmar(t("devoluciones.confirmar_eliminar"), { peligroso: true }))) return;

    try {
      await eliminarDevolucion(devolucion);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = mensajeErrorSeguro(error);
      mostrarToast(detalle || t("devoluciones.msg_error_eliminar"), "error");
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
        Icono={RotateCcw}
        color="#fb7185"
        titulo={t("sidebar.devoluciones")}
        subtitulo={t("devoluciones.subtitulo")}
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
        <h2 style={{ marginBottom: 16 }}>{t("devoluciones.registrar")}</h2>

        <div className="productos-grid">
          <SelectorPersonalizado value={productoId} onChange={setProductoId}>
            <OpcionSelector value="">{t("devoluciones.selecciona_producto")}</OpcionSelector>
            {productos.map((p) => (
              <OpcionSelector key={p.id} value={p.id}>
                {p.nombre} — {t("dashboard.stock_actual")}: {p.stock}
              </OpcionSelector>
            ))}
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
            type="number"
            min="0"
            step="0.01"
            value={montoReembolsado}
            onChange={(e) => setMontoReembolsado(e.target.value)}
            placeholder={t("devoluciones.monto_reembolsado")}
          />

          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={t("devoluciones.motivo_placeholder")}
          />
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 16,
            fontSize: 13.5,
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={reponerStock}
            onChange={(e) => setReponerStock(e.target.checked)}
          />
          {t("devoluciones.reponer_stock")}
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? t("compras.guardando") : t("devoluciones.registrar")}
          </button>
        </div>
      </div>

      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>{t("tabla.fecha")}</th>
              <th>{t("tabla.producto")}</th>
              <th>{t("tabla.cantidad")}</th>
              <th>{t("devoluciones.col_reembolso")}</th>
              <th>{t("devoluciones.col_stock")}</th>
              <th>{t("ajustes_stock.col_motivo")}</th>
              <th>{t("productos.col_acciones")}</th>
            </tr>
          </thead>

          <tbody>
            {devoluciones.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  {t("devoluciones.sin_devoluciones")}
                </td>
              </tr>
            ) : (
              devoluciones.map((d) => (
                <tr key={d.id}>
                  <td>{new Date(d.fecha).toLocaleDateString()}</td>
                  <td>{d.producto}</td>
                  <td>{d.cantidad}</td>
                  <td>{formatoMoneda(d.monto_reembolsado)}</td>
                  <td>
                    {d.repuso_stock ? (
                      <span style={{ color: "#10b981", fontWeight: 600, fontSize: 12.5 }}>
                        {t("devoluciones.si_repuso")}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
                        {t("devoluciones.no_repuso")}
                      </span>
                    )}
                  </td>
                  <td>{d.motivo || "—"}</td>
                  <td>
                    <button
                      className="btn-delete"
                      aria-label={t("productos.eliminar")}
                      onClick={() => borrar(d)}
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
