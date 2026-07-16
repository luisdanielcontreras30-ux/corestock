"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import RequierePlus from "../../components/RequierePlus";
import { Producto, Proveedor, Compra } from "./types";
import { cargarDatos, registrarCompra, eliminarCompra } from "./acciones";
import { exportarExcel } from "./utils";

export default function ComprasPage() {
  return (
    <RequierePlus>
      <ComprasContenido />
    </RequierePlus>
  );
}

function ComprasContenido() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);

  const [productoId, setProductoId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [proveedorNombre, setProveedorNombre] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [costoUnitario, setCostoUnitario] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  async function obtenerDatos() {
    setLoading(true);
    try {
      const datos = await cargarDatos();
      setProductos(datos.productos);
      setProveedores(datos.proveedores);
      setCompras(datos.compras);
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
  const costoNum = Number(costoUnitario) || 0;
  const total = costoNum * cantidad;

  function alCambiarProveedorNombre(nombre: string) {
    setProveedorNombre(nombre);

    const encontrado = proveedores.find(
      (p) => p.nombre.toLowerCase() === nombre.toLowerCase()
    );

    setProveedorId(encontrado ? encontrado.id : "");
  }

  function alElegirProducto(id: string) {
    setProductoId(id);

    const p = productos.find((x) => x.id === Number(id));
    if (p && p.costo != null && p.costo > 0) {
      setCostoUnitario(String(p.costo));
    }
  }

  function limpiar() {
    setProductoId("");
    setProveedorId("");
    setProveedorNombre("");
    setCantidad(1);
    setCostoUnitario("");
    setNota("");
  }

  async function guardar() {
    if (guardando) return;

    if (!producto) {
      mostrarToast(t("compras.msg_selecciona_producto"), "error");
      return;
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      mostrarToast(t("compras.msg_cantidad_mayor"), "error");
      return;
    }

    if (!Number.isFinite(costoNum) || costoNum < 0) {
      mostrarToast(t("compras.msg_costo_invalido"), "error");
      return;
    }

    try {
      setGuardando(true);
      await registrarCompra(
        producto,
        proveedorId || null,
        proveedorNombre,
        cantidad,
        costoNum,
        nota
      );

      limpiar();
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = error instanceof Error ? error.message : "";
      mostrarToast(detalle || t("compras.msg_error_registrar"), "error");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id: number) {
    if (!(await confirmar(t("compras.confirmar_eliminar"), { peligroso: true }))) return;

    try {
      await eliminarCompra(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = error instanceof Error ? error.message : "";
      mostrarToast(`${t("compras.msg_error_eliminar")}${detalle ? ": " + detalle : ""}`, "error");
    }
  }

  const comprasFiltradas = compras.filter((c) => {
    const termino = busqueda.toLowerCase().trim();
    if (!termino) return true;
    return (
      c.producto.toLowerCase().includes(termino) ||
      (c.proveedor_nombre ?? "").toLowerCase().includes(termino)
    );
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
        Icono={ShoppingCart}
        color="#14b8a6"
        titulo={t("sidebar.compras")}
        subtitulo={t("compras.subtitulo")}
      />

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{t("compras.registrar")}</h2>

        <div className="productos-grid">
          <select value={productoId} onChange={(e) => alElegirProducto(e.target.value)}>
            <option value="">{t("compras.selecciona_producto")}</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — {t("dashboard.stock_actual")}: {p.stock}
              </option>
            ))}
          </select>

          <input
            list="lista-proveedores-compras"
            value={proveedorNombre}
            onChange={(e) => alCambiarProveedorNombre(e.target.value)}
            placeholder={t("compras.proveedor_placeholder")}
          />
          <datalist id="lista-proveedores-compras">
            {proveedores.map((p) => (
              <option key={p.id} value={p.nombre} />
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
            value={costoUnitario}
            onChange={(e) => setCostoUnitario(e.target.value)}
            placeholder={t("compras.costo_unitario")}
          />
        </div>

        <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 8 }}>
          {t("compras.nota_actualiza_costo")}
        </p>

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
            {guardando ? t("compras.guardando") : t("compras.registrar")}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input
          style={{ flex: 1, minWidth: 200 }}
          placeholder={t("compras.buscar")}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        {compras.length > 0 && (
          <button className="btn-secondary" onClick={() => exportarExcel(comprasFiltradas)}>
            {t("productos.exportar_excel")}
          </button>
        )}
      </div>

      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>{t("tabla.fecha")}</th>
              <th>{t("tabla.producto")}</th>
              <th>{t("compras.col_proveedor")}</th>
              <th>{t("tabla.cantidad")}</th>
              <th>{t("compras.costo_unitario")}</th>
              <th>{t("tabla.total")}</th>
              <th>{t("productos.col_acciones")}</th>
            </tr>
          </thead>

          <tbody>
            {comprasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  {compras.length === 0 ? t("compras.sin_compras") : t("compras.sin_resultados_busqueda")}
                </td>
              </tr>
            ) : (
              comprasFiltradas.map((c) => (
                <tr key={c.id}>
                  <td>{new Date(c.fecha).toLocaleDateString()}</td>
                  <td>{c.producto}</td>
                  <td>{c.proveedor_nombre || "—"}</td>
                  <td>{c.cantidad}</td>
                  <td>${Number(c.costo_unitario).toFixed(2)}</td>
                  <td>${Number(c.total).toFixed(2)}</td>
                  <td>
                    <button className="btn-delete" onClick={() => borrar(c.id)} aria-label={t("productos.eliminar")}>
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
