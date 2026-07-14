"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Trash2 } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { Producto, Ubicacion, StockUbicacion, Traspaso } from "./types";
import { cargarDatos, crearUbicacion, eliminarUbicacion, realizarTraspaso } from "./acciones";

const TIENDA = "__tienda__";

export default function TraspasosPage() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();

  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [stockUbicaciones, setStockUbicaciones] = useState<StockUbicacion[]>([]);
  const [traspasos, setTraspasos] = useState<Traspaso[]>([]);

  const [nombreUbicacion, setNombreUbicacion] = useState("");
  const [guardandoUbicacion, setGuardandoUbicacion] = useState(false);

  const [productoId, setProductoId] = useState("");
  const [origen, setOrigen] = useState(TIENDA);
  const [destino, setDestino] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [traspasando, setTraspasando] = useState(false);

  const [ubicacionVista, setUbicacionVista] = useState("");

  async function obtenerDatos() {
    setLoading(true);
    try {
      const datos = await cargarDatos();
      setProductos(datos.productos);
      setUbicaciones(datos.ubicaciones);
      setStockUbicaciones(datos.stockUbicaciones);
      setTraspasos(datos.traspasos);
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

  const ubicacionVistaActual = ubicacionVista || (ubicaciones[0] ? String(ubicaciones[0].id) : "");

  async function agregarUbicacion() {
    if (guardandoUbicacion) return;

    if (!nombreUbicacion.trim()) {
      alert(t("traspasos.msg_falta_nombre_ubicacion"));
      return;
    }

    try {
      setGuardandoUbicacion(true);
      await crearUbicacion(nombreUbicacion);
      setNombreUbicacion("");
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(t("traspasos.msg_error_ubicacion"));
    } finally {
      setGuardandoUbicacion(false);
    }
  }

  async function borrarUbicacion(id: number) {
    if (!confirm(t("traspasos.confirmar_eliminar_ubicacion"))) return;

    try {
      await eliminarUbicacion(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : t("traspasos.msg_error_eliminar_ubicacion"));
    }
  }

  const producto = productos.find((p) => p.id === Number(productoId)) ?? null;

  const stockOrigenDisponible = useMemo(() => {
    if (!producto) return 0;
    if (origen === TIENDA) return producto.stock;

    const fila = stockUbicaciones.find(
      (s) => s.producto_id === producto.id && s.ubicacion_id === Number(origen)
    );
    return fila?.stock ?? 0;
  }, [producto, origen, stockUbicaciones]);

  function limpiarTraspaso() {
    setProductoId("");
    setOrigen(TIENDA);
    setDestino("");
    setCantidad("");
  }

  async function hacerTraspaso() {
    if (traspasando) return;

    if (!producto) {
      alert(t("traspasos.msg_selecciona_producto"));
      return;
    }

    if (!destino) {
      alert(t("traspasos.selecciona_destino"));
      return;
    }

    if (origen === destino) {
      alert(t("traspasos.msg_origen_destino_iguales"));
      return;
    }

    const cantidadNum = Number(cantidad);
    if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
      alert(t("fabricacion.msg_cantidad_invalida"));
      return;
    }

    const origenId = origen === TIENDA ? null : Number(origen);
    const destinoId = destino === TIENDA ? null : Number(destino);
    const origenNombre = origen === TIENDA ? null : ubicaciones.find((u) => u.id === origenId)?.nombre ?? null;
    const destinoNombre = destino === TIENDA ? null : ubicaciones.find((u) => u.id === destinoId)?.nombre ?? null;

    try {
      setTraspasando(true);
      await realizarTraspaso(producto, cantidadNum, origenId, destinoId, origenNombre, destinoNombre);
      limpiarTraspaso();
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : t("traspasos.msg_error_traspaso"));
    } finally {
      setTraspasando(false);
    }
  }

  const stockEnUbicacionVista = stockUbicaciones.filter(
    (s) => String(s.ubicacion_id) === ubicacionVistaActual
  );

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
          <ArrowRightLeft size={28} /> {t("sidebar.traspasos")}
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>{t("traspasos.subtitulo")}</p>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{t("traspasos.ubicaciones")}</h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={nombreUbicacion}
            onChange={(e) => setNombreUbicacion(e.target.value)}
            placeholder={t("traspasos.nombre_ubicacion_placeholder")}
            style={{ maxWidth: 260 }}
          />
          <button className="btn-primary" onClick={agregarUbicacion} disabled={guardandoUbicacion}>
            {t("traspasos.agregar_ubicacion")}
          </button>
        </div>

        {ubicaciones.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            {ubicaciones.map((u) => (
              <span
                key={u.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "var(--bg-secondary)",
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                {u.nombre}
                <button
                  className="btn-delete"
                  aria-label={t("productos.eliminar")}
                  onClick={() => borrarUbicacion(u.id)}
                  style={{ padding: 2 }}
                >
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{t("traspasos.traspasar")}</h2>

        <div className="productos-grid">
          <select value={productoId} onChange={(e) => setProductoId(e.target.value)}>
            <option value="">{t("fabricacion.selecciona_producto")}</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>

          <select value={origen} onChange={(e) => setOrigen(e.target.value)}>
            <option value={TIENDA}>{t("traspasos.tienda")}</option>
            {ubicaciones.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>

          <select value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">{t("traspasos.selecciona_destino")}</option>
            <option value={TIENDA}>{t("traspasos.tienda")}</option>
            {ubicaciones.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="0.01"
            step="0.01"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder={t("fabricacion.cantidad_a_producir")}
          />
        </div>

        {producto && (
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 10 }}>
            {t("traspasos.disponible_en_origen")}: <strong>{stockOrigenDisponible}</strong>
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn-primary" onClick={hacerTraspaso} disabled={traspasando}>
            {traspasando ? t("compras.guardando") : t("traspasos.traspasar")}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{t("traspasos.stock_por_ubicacion")}</h2>

        {ubicaciones.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: 13.5 }}>{t("traspasos.sin_ubicaciones")}</p>
        ) : (
          <>
            <select value={ubicacionVistaActual} onChange={(e) => setUbicacionVista(e.target.value)} style={{ maxWidth: 260 }}>
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>

            <div className="tabla" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>{t("tabla.producto")}</th>
                    <th>{t("traspasos.col_stock")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stockEnUbicacionVista.length === 0 ? (
                    <tr>
                      <td colSpan={2} style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>
                        {t("traspasos.sin_stock_ubicacion")}
                      </td>
                    </tr>
                  ) : (
                    stockEnUbicacionVista.map((s) => (
                      <tr key={s.id}>
                        <td>{s.producto_nombre}</td>
                        <td style={{ fontWeight: 700 }}>{s.stock}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>{t("tabla.fecha")}</th>
              <th>{t("tabla.producto")}</th>
              <th>{t("traspasos.col_origen")}</th>
              <th>{t("traspasos.col_destino")}</th>
              <th>{t("tabla.total")}</th>
            </tr>
          </thead>
          <tbody>
            {traspasos.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  {t("traspasos.sin_traspasos")}
                </td>
              </tr>
            ) : (
              traspasos.map((tr) => (
                <tr key={tr.id}>
                  <td>{new Date(tr.fecha).toLocaleString()}</td>
                  <td>{tr.producto_nombre}</td>
                  <td>{tr.ubicacion_origen_nombre ?? t("traspasos.tienda")}</td>
                  <td>{tr.ubicacion_destino_nombre ?? t("traspasos.tienda")}</td>
                  <td style={{ fontWeight: 700 }}>{tr.cantidad}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
