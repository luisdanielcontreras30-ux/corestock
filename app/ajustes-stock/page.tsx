"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, Trash2, PlusCircle, MinusCircle, Info, History } from "lucide-react";
import { mensajeErrorSeguro } from "../../lib/errores";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import TarjetaDesplegable from "../../components/TarjetaDesplegable";
import SelectorPersonalizado, { OpcionSelector } from "../../components/SelectorPersonalizado";
import { Producto, AjusteStock } from "./types";
import { cargarDatos, registrarAjuste, eliminarAjuste } from "./acciones";
import CargandoLista from "../../components/CargandoLista";
import { ordenarPorCategoria } from "../../lib/ordenarPorCategoria";

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
      case "CANTIDAD_INVALIDA":
        return t("ajustes_stock.msg_cantidad_mayor");
      case "SIN_STOCK":
        return t("ajustes_stock.msg_sin_stock");
      case "STOCK_CAMBIO":
        return t("comun.msg_stock_cambio");
      case "YA_ELIMINADA":
        return t("comun.msg_ya_eliminado");
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

  const productosOrdenados = useMemo(
    () => ordenarPorCategoria(productos, t("productos.sin_categoria")),
    [productos, t]
  );

  // Resumen a partir de los ajustes YA cargados: ninguna consulta
  // nueva. Un número arriba convierte la pantalla en un módulo con
  // estado propio en vez de un formulario suelto.
  const resumen = useMemo(() => {
    let agregadas = 0;
    let quitadas = 0;
    for (const a of ajustes) {
      if (a.cantidad_ajuste >= 0) agregadas += a.cantidad_ajuste;
      else quitadas += -a.cantidad_ajuste;
    }
    return { total: ajustes.length, agregadas, quitadas };
  }, [ajustes]);

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
        <CargandoLista />
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
        <CargandoLista />
      ) : error ? (
        <div className="card" style={{ textAlign: "center", padding: "50px 20px" }}>
          <p style={{ color: "#ef4444", marginBottom: 14 }}>{t("comun.msg_error_cargar_datos")}</p>
          <button className="btn-primary" onClick={obtenerDatos}>
            {t("empresa.reintentar")}
          </button>
        </div>
      ) : (
      <>
      {/* Qué es esto. La pantalla llevaba el nombre "Ajustes de stock" y
          nada más: quien no supiera de antemano para qué sirve, no lo
          averiguaba mirándola. */}
      <div className="ajustes-explica">
        <span className="ajustes-explica-icono">
          <Info size={18} />
        </span>
        <p>{t("ajustes_stock.explicacion")}</p>
      </div>

      <div className="ajustes-resumen">
        <div className="ajustes-resumen-item">
          <span className="ajustes-resumen-valor">{resumen.total}</span>
          <span className="ajustes-resumen-etiqueta">{t("ajustes_stock.resumen_total")}</span>
        </div>
        <div className="ajustes-resumen-item ajustes-resumen-positivo">
          <span className="ajustes-resumen-valor">+{resumen.agregadas}</span>
          <span className="ajustes-resumen-etiqueta">{t("ajustes_stock.resumen_agregadas")}</span>
        </div>
        <div className="ajustes-resumen-item ajustes-resumen-negativo">
          <span className="ajustes-resumen-valor">-{resumen.quitadas}</span>
          <span className="ajustes-resumen-etiqueta">{t("ajustes_stock.resumen_quitadas")}</span>
        </div>
      </div>

      <TarjetaDesplegable
        Icono={SlidersHorizontal}
        titulo={t("ajustes_stock.registrar")}
        subtitulo={t("ajustes_stock.registrar_ayuda")}
      >
        {/* Agregar o quitar era un desplegable de dos opciones: dos
            toques y sin ninguna pista visual de cuál estaba elegida.
            Como par de botones se ve de un vistazo, y el color dice
            hacia dónde va el stock antes de leer nada. */}
        <div className="ajustes-tipo">
          <button
            type="button"
            className={`ajustes-tipo-boton ${tipo === "agregar" ? "ajustes-tipo-activo-agregar" : ""}`}
            onClick={() => setTipo("agregar")}
            aria-pressed={tipo === "agregar"}
          >
            <PlusCircle size={16} /> {t("ajustes_stock.tipo_agregar")}
          </button>
          <button
            type="button"
            className={`ajustes-tipo-boton ${tipo === "quitar" ? "ajustes-tipo-activo-quitar" : ""}`}
            onClick={() => setTipo("quitar")}
            aria-pressed={tipo === "quitar"}
          >
            <MinusCircle size={16} /> {t("ajustes_stock.tipo_quitar")}
          </button>
        </div>

        <div className="productos-grid">
          <SelectorPersonalizado value={productoId} onChange={setProductoId}>
            <OpcionSelector value="">{t("ajustes_stock.selecciona_producto")}</OpcionSelector>
            {productosOrdenados.map((p) => (
              <OpcionSelector key={p.id} value={p.id} grupo={p.categoria?.trim() || t("productos.sin_categoria")}>
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
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={t("ajustes_stock.motivo_placeholder")}
          />
        </div>

        {/* Cómo queda el stock, antes de guardar. Es la pregunta que se
            hace cualquiera al corregir inventario, y hasta ahora había
            que hacer la cuenta de cabeza. */}
        {producto && cantidadNum > 0 && (
          <p className="ajustes-previo">
            {producto.nombre}: <strong>{producto.stock}</strong>
            {" → "}
            <strong style={{ color: tipo === "agregar" ? "#10b981" : "#ef4444" }}>
              {tipo === "agregar" ? producto.stock + cantidadNum : producto.stock - cantidadNum}
            </strong>
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? t("compras.guardando") : t("ajustes_stock.registrar")}
          </button>
        </div>
      </TarjetaDesplegable>

      <h2 className="ajustes-historial-titulo">
        <History size={18} /> {t("ajustes_stock.historial")}
      </h2>

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
