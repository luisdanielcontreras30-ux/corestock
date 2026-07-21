"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Check, X, Trash2, ShoppingCart, Share2 } from "lucide-react";
import { mensajeErrorSeguro } from "../../lib/errores";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import RequierePlus from "../../components/RequierePlus";
import SelectorPersonalizado, { OpcionSelector } from "../../components/SelectorPersonalizado";
import CotizacionCompartirModal from "./components/CotizacionCompartirModal";
import { Producto, Cliente, Cotizacion, EstadoCotizacion } from "./types";
import {
  cargarDatos,
  crearCotizacion,
  cambiarEstadoCotizacion,
  eliminarCotizacion,
  convertirEnVenta,
} from "./acciones";
import { exportarExcel } from "./utils";
import { formatoMoneda } from "../ventas/utils";

const COLOR_ESTADO: Record<EstadoCotizacion, string> = {
  pendiente: "#f59e0b",
  aceptada: "#10b981",
  rechazada: "#ef4444",
};

export default function CotizacionesPage() {
  return (
    <RequierePlus>
      <CotizacionesContenido />
    </RequierePlus>
  );
}

function CotizacionesContenido() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);

  const [productoId, setProductoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [precioUnitario, setPrecioUnitario] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [convirtiendoId, setConvirtiendoId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoCotizacion | "">("");
  const [compartiendo, setCompartiendo] = useState<Cotizacion | null>(null);

  // acciones.ts lanza sentinels sin traducir (ver comentario en
  // lib/errores.ts) para los casos donde sí hay un mensaje pensado
  // para mostrarse — esta función los traduce; null si el error no es
  // ninguno de los esperados (deja pasar a mensajeErrorSeguro/fallback).
  function mensajeCotizacion(error: unknown): string | null {
    if (!(error instanceof Error)) return null;
    switch (error.message) {
      case "CANTIDAD_INVALIDA":
        return t("cotizaciones.msg_cantidad_mayor");
      case "PRECIO_INVALIDO":
        return t("cotizaciones.msg_precio_invalido");
      case "NO_ACEPTADA":
        return t("cotizaciones.msg_no_aceptada");
      case "YA_CONVERTIDA":
        return t("cotizaciones.msg_ya_convertida");
      case "PRODUCTO_NO_EXISTE":
        return t("cotizaciones.msg_producto_no_existe");
      case "STOCK_INSUFICIENTE_CONVERSION":
        return t("cotizaciones.msg_stock_insuficiente_conversion");
      case "STOCK_CAMBIO":
        return t("comun.msg_stock_cambio");
      default:
        return null;
    }
  }

  async function obtenerDatos() {
    setLoading(true);
    try {
      const datos = await cargarDatos();
      setProductos(datos.productos);
      setClientes(datos.clientes);
      setCotizaciones(datos.cotizaciones);
    } catch (error) {
      console.error(error);
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
  const precioNum = Number(precioUnitario) || 0;
  const total = precioNum * cantidad;

  function alCambiarClienteNombre(nombre: string) {
    setClienteNombre(nombre);

    const encontrado = clientes.find(
      (c) => c.nombre.toLowerCase() === nombre.toLowerCase()
    );

    setClienteId(encontrado ? String(encontrado.id) : "");
  }

  function alElegirProducto(id: string) {
    setProductoId(id);

    const p = productos.find((x) => x.id === Number(id));
    if (p) {
      setPrecioUnitario(String(p.precio_venta));
    }
  }

  function limpiar() {
    setProductoId("");
    setClienteId("");
    setClienteNombre("");
    setCantidad(1);
    setPrecioUnitario("");
    setNota("");
  }

  async function guardar() {
    if (guardando) return;

    if (!producto) {
      mostrarToast(t("cotizaciones.msg_selecciona_producto"), "error");
      return;
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      mostrarToast(t("cotizaciones.msg_cantidad_mayor"), "error");
      return;
    }

    if (!Number.isInteger(cantidad)) {
      mostrarToast(t("comun.msg_cantidad_entera"), "error");
      return;
    }

    if (!Number.isFinite(precioNum) || precioNum < 0) {
      mostrarToast(t("cotizaciones.msg_precio_invalido"), "error");
      return;
    }

    try {
      setGuardando(true);
      await crearCotizacion(
        producto,
        clienteId ? Number(clienteId) : null,
        clienteNombre,
        cantidad,
        precioNum,
        nota
      );

      limpiar();
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = mensajeCotizacion(error) || mensajeErrorSeguro(error);
      mostrarToast(detalle || t("cotizaciones.msg_error_guardar"), "error");
    } finally {
      setGuardando(false);
    }
  }

  async function alCambiarEstado(id: number, estado: EstadoCotizacion) {
    if (estado === "rechazada" && !(await confirmar(t("cotizaciones.confirmar_rechazar")))) return;

    try {
      await cambiarEstadoCotizacion(id, estado);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      mostrarToast(t("cotizaciones.msg_error_estado"), "error");
    }
  }

  async function borrar(id: number) {
    if (!(await confirmar(t("cotizaciones.confirmar_eliminar"), { peligroso: true }))) return;

    try {
      await eliminarCotizacion(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      mostrarToast(t("cotizaciones.msg_error_eliminar"), "error");
    }
  }

  async function alConvertirEnVenta(cotizacion: Cotizacion) {
    if (convirtiendoId !== null) return;
    if (!(await confirmar(t("cotizaciones.confirmar_convertir")))) return;

    try {
      setConvirtiendoId(cotizacion.id);
      await convertirEnVenta(cotizacion);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = mensajeCotizacion(error) || mensajeErrorSeguro(error);
      mostrarToast(detalle || t("cotizaciones.msg_error_convertir"), "error");
    } finally {
      setConvirtiendoId(null);
    }
  }

  const cotizacionesFiltradas = useMemo(
    () =>
      cotizaciones.filter((c) => {
        if (filtroEstado !== "" && c.estado !== filtroEstado) return false;

        const termino = busqueda.toLowerCase().trim();
        if (!termino) return true;

        const nombreCliente = (c.cliente_nombre ?? t("ventas.cliente_general")).toLowerCase();
        return nombreCliente.includes(termino) || c.producto.toLowerCase().includes(termino);
      }),
    [cotizaciones, filtroEstado, busqueda, t]
  );

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
        Icono={FileText}
        color="#3b82f6"
        titulo={t("sidebar.cotizaciones")}
        subtitulo={t("cotizaciones.subtitulo")}
      />

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{t("cotizaciones.registrar")}</h2>

        <div className="productos-grid">
          <SelectorPersonalizado value={productoId} onChange={alElegirProducto}>
            <OpcionSelector value="">{t("cotizaciones.selecciona_producto")}</OpcionSelector>
            {productos.map((p) => (
              <OpcionSelector key={p.id} value={p.id}>
                {p.nombre}
              </OpcionSelector>
            ))}
          </SelectorPersonalizado>

          <input
            list="lista-clientes-cotizaciones"
            value={clienteNombre}
            onChange={(e) => alCambiarClienteNombre(e.target.value)}
            placeholder={t("ventas.cliente")}
          />
          <datalist id="lista-clientes-cotizaciones">
            {clientes.map((c) => (
              <option key={c.id} value={c.nombre} />
            ))}
          </datalist>

          <input
            type="number"
            min="1"
            step="1"
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
            placeholder={t("tabla.cantidad")}
          />

          <input
            type="number"
            min="0"
            step="0.01"
            value={precioUnitario}
            onChange={(e) => setPrecioUnitario(e.target.value)}
            placeholder={t("cotizaciones.precio_unitario")}
          />
        </div>

        <input
          style={{ marginTop: 12 }}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder={t("compras.nota_placeholder")}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 16,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            {t("tabla.total")}: {formatoMoneda(total)}
          </span>

          <button className="btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? t("compras.guardando") : t("cotizaciones.registrar")}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input
          style={{ flex: 1, minWidth: 200 }}
          placeholder={t("cotizaciones.buscar")}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <SelectorPersonalizado
          style={{ minWidth: 180 }}
          value={filtroEstado}
          onChange={(v) => setFiltroEstado(v as EstadoCotizacion | "")}
        >
          <OpcionSelector value="">{t("cotizaciones.todos_estados")}</OpcionSelector>
          <OpcionSelector value="pendiente">{t("cotizaciones.estado_pendiente")}</OpcionSelector>
          <OpcionSelector value="aceptada">{t("cotizaciones.estado_aceptada")}</OpcionSelector>
          <OpcionSelector value="rechazada">{t("cotizaciones.estado_rechazada")}</OpcionSelector>
        </SelectorPersonalizado>

        {cotizaciones.length > 0 && (
          <button className="btn-secondary" onClick={() => exportarExcel(cotizacionesFiltradas)}>
            {t("productos.exportar_excel")}
          </button>
        )}
      </div>

      {loading ? (
        <div className="card">{t("header.cargando")}</div>
      ) : (
      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>{t("tabla.fecha")}</th>
              <th>{t("ventas.cliente")}</th>
              <th>{t("tabla.producto")}</th>
              <th>{t("tabla.cantidad")}</th>
              <th>{t("tabla.total")}</th>
              <th>{t("cotizaciones.col_estado")}</th>
              <th>{t("productos.col_acciones")}</th>
            </tr>
          </thead>

          <tbody>
            {cotizacionesFiltradas.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  {cotizaciones.length === 0 ? t("cotizaciones.sin_cotizaciones") : t("cotizaciones.sin_resultados_busqueda")}
                </td>
              </tr>
            ) : (
              cotizacionesFiltradas.map((c) => (
                <tr key={c.id}>
                  <td>{new Date(c.fecha).toLocaleDateString()}</td>
                  <td>{c.cliente_nombre || t("ventas.cliente_general")}</td>
                  <td>{c.producto}</td>
                  <td>{c.cantidad}</td>
                  <td>{formatoMoneda(Number(c.total))}</td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                      <span
                        style={{
                          background: `${COLOR_ESTADO[c.estado]}1a`,
                          color: COLOR_ESTADO[c.estado],
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 700,
                        }}
                      >
                        {t(`cotizaciones.estado_${c.estado}`)}
                      </span>
                      {c.venta_id && (
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                          {t("cotizaciones.convertida_badge")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        className="btn-edit"
                        aria-label={t("cotizaciones.compartir")}
                        onClick={() => setCompartiendo(c)}
                      >
                        <Share2 size={14} />
                      </button>
                      {c.estado === "pendiente" && (
                        <>
                          <button
                            className="btn-success"
                            aria-label={t("cotizaciones.estado_aceptada")}
                            onClick={() => alCambiarEstado(c.id, "aceptada")}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            className="btn-delete"
                            aria-label={t("cotizaciones.estado_rechazada")}
                            onClick={() => alCambiarEstado(c.id, "rechazada")}
                          >
                            <X size={14} />
                          </button>
                        </>
                      )}
                      {c.estado === "aceptada" && !c.venta_id && (
                        <button
                          className="btn-primary"
                          style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px" }}
                          aria-label={t("cotizaciones.convertir_venta")}
                          onClick={() => alConvertirEnVenta(c)}
                          disabled={convirtiendoId === c.id}
                        >
                          <ShoppingCart size={14} /> {t("cotizaciones.convertir_venta")}
                        </button>
                      )}
                      <button
                        className="btn-delete"
                        aria-label={t("productos.eliminar")}
                        onClick={() => borrar(c.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      {compartiendo && (
        <CotizacionCompartirModal
          cotizacion={compartiendo}
          onClose={() => setCompartiendo(null)}
        />
      )}
    </main>
  );
}
