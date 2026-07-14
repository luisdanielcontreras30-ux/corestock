"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Check, X, Trash2, ShoppingCart, Share2 } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import RequierePlus from "../../components/RequierePlus";
import CotizacionCompartirModal from "./components/CotizacionCompartirModal";
import { Producto, Cliente, Cotizacion, EstadoCotizacion } from "./types";
import {
  cargarDatos,
  crearCotizacion,
  cambiarEstadoCotizacion,
  eliminarCotizacion,
  convertirEnVenta,
} from "./acciones";

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

  async function obtenerDatos() {
    setLoading(true);
    try {
      const datos = await cargarDatos();
      setProductos(datos.productos);
      setClientes(datos.clientes);
      setCotizaciones(datos.cotizaciones);
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
      alert(t("cotizaciones.msg_selecciona_producto"));
      return;
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      alert(t("cotizaciones.msg_cantidad_mayor"));
      return;
    }

    if (!Number.isFinite(precioNum) || precioNum < 0) {
      alert(t("cotizaciones.msg_precio_invalido"));
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
      const detalle = error instanceof Error ? error.message : "";
      alert(detalle || t("cotizaciones.msg_error_guardar"));
    } finally {
      setGuardando(false);
    }
  }

  async function alCambiarEstado(id: number, estado: EstadoCotizacion) {
    try {
      await cambiarEstadoCotizacion(id, estado);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(t("cotizaciones.msg_error_estado"));
    }
  }

  async function borrar(id: number) {
    if (!confirm(t("cotizaciones.confirmar_eliminar"))) return;

    try {
      await eliminarCotizacion(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(t("cotizaciones.msg_error_eliminar"));
    }
  }

  async function alConvertirEnVenta(cotizacion: Cotizacion) {
    if (convirtiendoId !== null) return;
    if (!confirm(t("cotizaciones.confirmar_convertir"))) return;

    try {
      setConvirtiendoId(cotizacion.id);
      await convertirEnVenta(cotizacion);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = error instanceof Error ? error.message : "";
      alert(detalle || t("cotizaciones.msg_error_convertir"));
    } finally {
      setConvirtiendoId(null);
    }
  }

  const cotizacionesFiltradas = cotizaciones.filter((c) => {
    if (filtroEstado !== "" && c.estado !== filtroEstado) return false;

    const termino = busqueda.toLowerCase().trim();
    if (!termino) return true;

    const nombreCliente = (c.cliente_nombre ?? t("ventas.cliente_general")).toLowerCase();
    return nombreCliente.includes(termino) || c.producto.toLowerCase().includes(termino);
  });

  if (cargandoAuth || !user || loading) {
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
          <select value={productoId} onChange={(e) => alElegirProducto(e.target.value)}>
            <option value="">{t("cotizaciones.selecciona_producto")}</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>

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
            {t("tabla.total")}: ${total.toFixed(2)}
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

        <select
          style={{ minWidth: 180 }}
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as EstadoCotizacion | "")}
        >
          <option value="">{t("cotizaciones.todos_estados")}</option>
          <option value="pendiente">{t("cotizaciones.estado_pendiente")}</option>
          <option value="aceptada">{t("cotizaciones.estado_aceptada")}</option>
          <option value="rechazada">{t("cotizaciones.estado_rechazada")}</option>
        </select>
      </div>

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
                  <td>${Number(c.total).toFixed(2)}</td>
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
                            className="btn-edit"
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
                          style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", fontSize: 12 }}
                          aria-label={t("cotizaciones.convertir_venta")}
                          onClick={() => alConvertirEnVenta(c)}
                          disabled={convirtiendoId === c.id}
                        >
                          <ShoppingCart size={13} /> {t("cotizaciones.convertir_venta")}
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

      {compartiendo && (
        <CotizacionCompartirModal
          cotizacion={compartiendo}
          onClose={() => setCompartiendo(null)}
        />
      )}
    </main>
  );
}
