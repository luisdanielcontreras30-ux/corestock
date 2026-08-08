"use client";

import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, Trash2, PackagePlus, Wallet, CalendarDays} from "lucide-react";
import { useRouter } from "next/navigation";
import { mensajeErrorSeguro } from "../../lib/errores";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import TarjetaDesplegable from "../../components/TarjetaDesplegable";
import RequierePlus from "../../components/RequierePlus";
import SelectorPersonalizado, { OpcionSelector } from "../../components/SelectorPersonalizado";
import CampoConSugerencias from "../../components/CampoConSugerencias";
import { Producto, Proveedor, Compra } from "./types";
import { cargarDatos, registrarCompra, eliminarCompra } from "./acciones";
import { exportarExcel } from "./utils";
import { formatoMoneda } from "../ventas/utils";
import CargandoLista from "../../components/CargandoLista";
import FilaVacia from "../../components/FilaVacia";

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

  // acciones.ts lanza sentinels sin traducir (ver comentario en
  // lib/errores.ts) para los casos donde sí hay un mensaje pensado
  // para mostrarse — esta función los traduce; null si el error no es
  // ninguno de los esperados (deja pasar a mensajeErrorSeguro/fallback).
  function mensajeCompra(error: unknown): string | null {
    if (!(error instanceof Error)) return null;
    switch (error.message) {
      case "CANTIDAD_INVALIDA":
        return t("compras.msg_cantidad_mayor");
      case "COSTO_INVALIDO":
        return t("compras.msg_costo_invalido");
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

    // Si el producto nuevo no tiene un costo previo, se limpia el campo
    // en vez de dejar el costo del producto elegido antes — si no, al
    // cambiar de un producto con costo a otro sin costo, el campo se
    // quedaba mostrando (y se podía guardar) el costo equivocado.
    const p = productos.find((x) => x.id === Number(id));
    setCostoUnitario(p && p.costo != null && p.costo > 0 ? String(p.costo) : "");
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

    if (!Number.isInteger(cantidad)) {
      mostrarToast(t("comun.msg_cantidad_entera"), "error");
      return;
    }

    if (!Number.isFinite(costoNum) || costoNum <= 0) {
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
      const detalle = mensajeCompra(error) || mensajeErrorSeguro(error);
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
      const detalle = mensajeCompra(error) || mensajeErrorSeguro(error);
      mostrarToast(`${t("compras.msg_error_eliminar")}${detalle ? ": " + detalle : ""}`, "error");
    }
  }

  // Resumen del mes con lo que YA está cargado: ninguna consulta nueva.
  // Compras se sentía "muy simple" porque solo mostraba un formulario y
  // una lista, sin decir en ningún momento cuánto se lleva gastado.
  const resumen = useMemo(() => {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
    let gastadoMes = 0;
    let comprasMes = 0;
    for (const c of compras) {
      if (c.fecha >= inicioMes) {
        gastadoMes += Number(c.total) || 0;
        comprasMes += 1;
      }
    }
    return { gastadoMes, comprasMes, total: compras.length };
  }, [compras]);

  const comprasFiltradas = useMemo(
    () =>
      compras.filter((c) => {
        const termino = busqueda.toLowerCase().trim();
        if (!termino) return true;
        return (
          c.producto.toLowerCase().includes(termino) ||
          (c.proveedor_nombre ?? "").toLowerCase().includes(termino)
        );
      }),
    [compras, busqueda]
  );

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
        Icono={ShoppingCart}
        color="#14b8a6"
        titulo={t("sidebar.compras")}
        subtitulo={t("compras.subtitulo")}
      />

      <div className="modulo-resumen">
        <div className="modulo-resumen-item">
          <span className="modulo-resumen-icono">
            <Wallet size={17} />
          </span>
          <div>
            <span className="modulo-resumen-valor">{formatoMoneda(resumen.gastadoMes)}</span>
            <span className="modulo-resumen-etiqueta">{t("compras.resumen_gastado_mes")}</span>
          </div>
        </div>
        <div className="modulo-resumen-item">
          <span className="modulo-resumen-icono">
            <CalendarDays size={17} />
          </span>
          <div>
            <span className="modulo-resumen-valor">{resumen.comprasMes}</span>
            <span className="modulo-resumen-etiqueta">{t("compras.resumen_compras_mes")}</span>
          </div>
        </div>
        <div className="modulo-resumen-item">
          <span className="modulo-resumen-icono">
            <PackagePlus size={17} />
          </span>
          <div>
            <span className="modulo-resumen-valor">{resumen.total}</span>
            <span className="modulo-resumen-etiqueta">{t("compras.resumen_total")}</span>
          </div>
        </div>
      </div>

      <TarjetaDesplegable
        Icono={PackagePlus}
        titulo={t("compras.registrar")}
        subtitulo={t("compras.registrar_ayuda")}
      >
        <div className="productos-grid">
          <SelectorPersonalizado value={productoId} onChange={alElegirProducto}>
            <OpcionSelector value="">{t("compras.selecciona_producto")}</OpcionSelector>
            {productos.map((p) => (
              <OpcionSelector key={p.id} value={p.id}>
                {p.nombre} — {t("dashboard.stock_actual")}: {p.stock}
              </OpcionSelector>
            ))}
          </SelectorPersonalizado>

          <CampoConSugerencias
            value={proveedorNombre}
            onChange={alCambiarProveedorNombre}
            opciones={proveedores.map((p) => p.nombre)}
            placeholder={t("compras.proveedor_placeholder")}
          />

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
            {t("tabla.total")}: {formatoMoneda(total)}
          </span>

          <button className="btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? t("compras.guardando") : t("compras.registrar")}
          </button>
        </div>
      </TarjetaDesplegable>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input
          style={{ flex: 1, minWidth: 200 }}
          placeholder={t("compras.buscar")}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        {comprasFiltradas.length > 0 && (
          <button className="btn-secondary" onClick={() => exportarExcel(comprasFiltradas)}>
            {t("productos.exportar_excel")}
          </button>
        )}
      </div>

      {loading ? (
        <CargandoLista />
      ) : (
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
                <FilaVacia
                  colSpan={7}
                  mensaje={compras.length === 0 ? t("compras.sin_compras") : t("compras.sin_resultados_busqueda")}
                />
              ) : (
                comprasFiltradas.map((c) => (
                  <tr key={c.id}>
                    <td>{new Date(c.fecha).toLocaleDateString()}</td>
                    <td>{c.producto}</td>
                    <td>{c.proveedor_nombre || "—"}</td>
                    <td>{c.cantidad}</td>
                    <td>{formatoMoneda(Number(c.costo_unitario))}</td>
                    <td>{formatoMoneda(Number(c.total))}</td>
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
      )}
    </main>
  );
}
