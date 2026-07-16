"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, Plus, Minus, Trash2, X, Zap } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import { useMiembroActivo } from "../../components/MiembroActivoProvider";
import SinPermiso from "../../components/SinPermiso";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import {
  cargarProductosVentaRapida,
  registrarVentaRapida,
  ItemCarrito,
  ErrorCobroParcial,
} from "./acciones";
import { Producto, Promocion, MetodoPago } from "../ventas/types";
import { CLAVE_METODO_PAGO, formatoMoneda } from "../ventas/utils";
import {
  obtenerPromocionAplicable,
  calcularPrecioConDescuento,
} from "../../lib/promociones";

const METODOS: MetodoPago[] = ["efectivo", "tarjeta", "transferencia"];

export default function VentasRapidasPage() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();
  const { puede } = useMiembroActivo();

  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<Map<number, number>>(new Map());

  const [panelAbierto, setPanelAbierto] = useState(false);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [recibido, setRecibido] = useState("");
  const [cobrando, setCobrando] = useState(false);

  // mostrarCarga solo se apaga cuando se refresca en segundo plano
  // (después de cobrar) — si reusara el mismo "loading" de la carga
  // inicial, toda la página (buscador, cuadrícula y carrito) parpadeaba
  // a la pantalla de carga completa justo después de cada venta, algo
  // muy notorio en una herramienta pensada para ir rápido entre clientes.
  async function obtenerDatos(mostrarCarga = true) {
    if (mostrarCarga) setLoading(true);
    try {
      const datos = await cargarProductosVentaRapida();
      setProductos(datos.productos);
      setPromociones(datos.promociones);
    } catch (error) {
      console.error(error);
      mostrarToast(t("comun.msg_error_cargar_datos"), "error");
    } finally {
      if (mostrarCarga) setLoading(false);
    }
  }

  useEffect(() => {
    if (cargandoAuth) return;

    if (!user) {
      router.push("/login");
      return;
    }

    obtenerDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargandoAuth, user]);

  function precioDe(producto: Producto): number {
    const promo = obtenerPromocionAplicable(producto.id, promociones);
    return calcularPrecioConDescuento(producto.precio_venta, promo);
  }

  const productosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return productos;
    return productos.filter((p) => p.nombre.toLowerCase().includes(texto));
  }, [productos, busqueda]);

  const itemsCarrito: ItemCarrito[] = useMemo(() => {
    const items: ItemCarrito[] = [];
    carrito.forEach((cantidad, productoId) => {
      const producto = productos.find((p) => p.id === productoId);
      if (producto) {
        items.push({
          producto,
          cantidad,
          precioUnitario: precioDe(producto),
        });
      }
    });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrito, productos, promociones]);

  const totalCarrito = itemsCarrito.reduce(
    (suma, item) => suma + item.precioUnitario * item.cantidad,
    0
  );
  const totalArticulos = itemsCarrito.reduce(
    (suma, item) => suma + item.cantidad,
    0
  );

  function agregarAlCarrito(producto: Producto) {
    // Forma funcional: si el usuario toca la tarjeta varias veces
    // rápido, cada actualización parte del carrito más reciente en vez
    // de una copia ya obsoleta capturada por el cierre del render
    // anterior — sin esto, dos taps casi simultáneos podían pisarse
    // entre sí y perder un artículo del carrito.
    setCarrito((prev) => {
      const enCarrito = prev.get(producto.id) ?? 0;

      if (enCarrito >= producto.stock) {
        mostrarToast(t("ventas_rapidas.msg_sin_stock"), "error");
        return prev;
      }

      const nuevo = new Map(prev);
      nuevo.set(producto.id, enCarrito + 1);
      return nuevo;
    });
  }

  function cambiarCantidad(productoId: number, delta: number) {
    setCarrito((prev) => {
      const producto = productos.find((p) => p.id === productoId);
      const actual = prev.get(productoId) ?? 0;
      const nuevaCantidad = actual + delta;

      if (nuevaCantidad <= 0) {
        const nuevo = new Map(prev);
        nuevo.delete(productoId);
        return nuevo;
      }

      if (producto && nuevaCantidad > producto.stock) {
        mostrarToast(t("ventas_rapidas.msg_sin_stock"), "error");
        return prev;
      }

      const nuevo = new Map(prev);
      nuevo.set(productoId, nuevaCantidad);
      return nuevo;
    });
  }

  async function vaciarCarrito() {
    if (carrito.size === 0) return;
    if (!(await confirmar(t("ventas_rapidas.confirmar_vaciar")))) return;
    setCarrito(new Map());
  }

  function abrirPanelCobro() {
    if (itemsCarrito.length === 0) return;
    setMetodoPago("efectivo");
    setRecibido("");
    setPanelAbierto(true);
  }

  const recibidoNum = Number(recibido) || 0;
  const cambio = recibidoNum - totalCarrito;
  const faltaRecibido = metodoPago === "efectivo" && recibidoNum < totalCarrito;

  async function confirmarCobro() {
    if (cobrando) return;

    if (faltaRecibido) {
      mostrarToast(t("ventas_rapidas.msg_recibido_insuficiente"), "error");
      return;
    }

    try {
      setCobrando(true);
      await registrarVentaRapida(itemsCarrito, metodoPago);
      mostrarToast(t("ventas_rapidas.msg_cobro_exitoso"), "exito");
      setCarrito(new Map());
      setPanelAbierto(false);
      await obtenerDatos(false);
    } catch (error) {
      console.error(error);
      const detalle = error instanceof Error ? error.message : "";
      mostrarToast(
        `${t("ventas_rapidas.msg_error_cobro")}${detalle ? ": " + detalle : ""}`,
        "error"
      );

      // El carrito pudo haberse cobrado a medias (algunos artículos ya
      // se registraron antes de que uno fallara). Esos productos se
      // quitan del carrito ahora mismo — si no, un reintento del
      // cajero los volvería a vender por segunda vez.
      if (error instanceof ErrorCobroParcial && error.productosVendidos.length > 0) {
        const vendidos = error.productosVendidos;
        setCarrito((prev) => {
          const nuevo = new Map(prev);
          for (const id of vendidos) nuevo.delete(id);
          return nuevo;
        });
      }

      await obtenerDatos(false);
    } finally {
      setCobrando(false);
    }
  }

  if (cargandoAuth || !user || loading) {
    return (
      <main className="fade-up">
        <div className="card">{t("header.cargando")}</div>
      </main>
    );
  }

  const puedeVender = puede("registrar_ventas");

  return (
    <main className="fade-up">
      <EncabezadoModulo
        Icono={Zap}
        color="#10b981"
        titulo={t("ventas_rapidas.titulo")}
        subtitulo={t("ventas_rapidas.subtitulo")}
      />

      {!puedeVender ? (
        <div style={{ marginTop: 20 }}>
          <SinPermiso />
        </div>
      ) : (
        <div className="venta-rapida-layout">
          <div>
            <div className="venta-rapida-buscador">
              <Search size={16} color="var(--text-secondary)" />
              <input
                type="text"
                placeholder={t("ventas_rapidas.buscar_placeholder")}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            {productosFiltrados.length === 0 ? (
              <div
                style={{
                  color: "var(--text-secondary)",
                  marginTop: 24,
                  textAlign: "center",
                }}
              >
                <p>
                  {productos.length === 0
                    ? t("ventas_rapidas.sin_productos_catalogo")
                    : t("ventas_rapidas.sin_productos")}
                </p>
                {productos.length === 0 && (
                  <Link href="/productos" className="btn-primary" style={{ display: "inline-block", marginTop: 8 }}>
                    {t("ventas_rapidas.ir_a_productos")}
                  </Link>
                )}
              </div>
            ) : (
              <div className="venta-rapida-grid">
                {productosFiltrados.map((producto) => {
                  const enCarrito = carrito.get(producto.id) ?? 0;
                  const sinStock = producto.stock <= 0;
                  const precio = precioDe(producto);
                  const tieneDescuento = precio < producto.precio_venta;

                  return (
                    <button
                      key={producto.id}
                      className="venta-rapida-card"
                      onClick={() => agregarAlCarrito(producto)}
                      disabled={sinStock}
                    >
                      {enCarrito > 0 && (
                        <span className="venta-rapida-card-badge">
                          {enCarrito}
                        </span>
                      )}

                      <div className="venta-rapida-card-imagen">
                        {producto.imagen ? (
                          <img src={producto.imagen} alt={producto.nombre} />
                        ) : (
                          <ShoppingCart size={26} color="var(--text-muted)" />
                        )}
                        {sinStock && (
                          <span className="venta-rapida-card-sinstock">
                            {t("ventas_rapidas.sin_stock")}
                          </span>
                        )}
                      </div>

                      <div className="venta-rapida-card-info">
                        <p className="venta-rapida-card-nombre">
                          {producto.nombre}
                        </p>
                        <p className="venta-rapida-card-precio">
                          {formatoMoneda(precio)}
                          {tieneDescuento && (
                            <span className="venta-rapida-card-precio-original">
                              {formatoMoneda(producto.precio_venta)}
                            </span>
                          )}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="venta-rapida-carrito card">
            <div className="venta-rapida-carrito-header">
              <h3>
                <ShoppingCart size={17} /> {t("ventas_rapidas.carrito_titulo")}
              </h3>
              {itemsCarrito.length > 0 && (
                <button className="venta-rapida-vaciar" onClick={vaciarCarrito}>
                  {t("ventas_rapidas.vaciar_carrito")}
                </button>
              )}
            </div>

            {itemsCarrito.length === 0 ? (
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  padding: "20px 0",
                  textAlign: "center",
                }}
              >
                {t("ventas_rapidas.carrito_vacio")}
              </p>
            ) : (
              <div className="venta-rapida-carrito-lista">
                {itemsCarrito.map((item) => (
                  <div key={item.producto.id} className="venta-rapida-carrito-item">
                    <div className="venta-rapida-carrito-item-info">
                      <p>{item.producto.nombre}</p>
                      <span>{formatoMoneda(item.precioUnitario)}</span>
                    </div>

                    <div className="venta-rapida-stepper">
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(item.producto.id, -1)}
                        aria-label="-"
                      >
                        <Minus size={13} />
                      </button>
                      <span>{item.cantidad}</span>
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(item.producto.id, 1)}
                        aria-label="+"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <button
                      type="button"
                      className="venta-rapida-quitar"
                      onClick={() =>
                        cambiarCantidad(item.producto.id, -item.cantidad)
                      }
                      aria-label={t("ventas_rapidas.quitar")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="venta-rapida-carrito-total">
              <span>{t("ventas_rapidas.total")}</span>
              <strong>{formatoMoneda(totalCarrito)}</strong>
            </div>

            <button
              className="btn-primary venta-rapida-cobrar-btn"
              disabled={itemsCarrito.length === 0}
              onClick={abrirPanelCobro}
            >
              {t("ventas_rapidas.cobrar")}
              {itemsCarrito.length > 0 && ` (${totalArticulos})`}
            </button>
          </div>
        </div>
      )}

      {panelAbierto && (
        <div
          className="factura-overlay"
          onClick={() => !cobrando && setPanelAbierto(false)}
        >
          <div
            className="factura-modal fade-up venta-rapida-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="factura-modal-toolbar">
              <h3 style={{ margin: 0 }}>{t("ventas_rapidas.panel_titulo")}</h3>
              <button
                className="btn-secondary"
                onClick={() => setPanelAbierto(false)}
                disabled={cobrando}
                aria-label={t("ventas_rapidas.cancelar")}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 20 }}>
              <div className="venta-rapida-monto-box">
                <span>{t("ventas_rapidas.monto_a_pagar")}</span>
                <strong>{formatoMoneda(totalCarrito)}</strong>
              </div>

              <div className="venta-rapida-metodos">
                {METODOS.map((metodo) => (
                  <button
                    key={metodo}
                    type="button"
                    className={
                      metodoPago === metodo ? "btn-primary" : "btn-secondary"
                    }
                    onClick={() => setMetodoPago(metodo)}
                  >
                    {t(CLAVE_METODO_PAGO[metodo])}
                  </button>
                ))}
              </div>

              {metodoPago === "efectivo" && (
                <div className="venta-rapida-efectivo">
                  <div>
                    <label>{t("ventas_rapidas.recibido")}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={recibido}
                      onChange={(e) => setRecibido(e.target.value)}
                      placeholder={formatoMoneda(totalCarrito)}
                      autoFocus
                    />
                  </div>

                  <div
                    className={`venta-rapida-cambio-box ${
                      cambio < 0 ? "venta-rapida-cambio-negativo" : ""
                    }`}
                  >
                    <span>
                      {cambio < 0
                        ? t("ventas_rapidas.falta")
                        : t("ventas_rapidas.cambio")}
                    </span>
                    <strong>{formatoMoneda(Math.abs(cambio))}</strong>
                  </div>
                </div>
              )}

              <div className="venta-rapida-panel-botones">
                <button
                  className="btn-delete"
                  onClick={() => setPanelAbierto(false)}
                  disabled={cobrando}
                >
                  {t("ventas_rapidas.cancelar")}
                </button>
                <button
                  className="btn-primary"
                  onClick={confirmarCobro}
                  disabled={cobrando || faltaRecibido}
                >
                  {cobrando
                    ? t("ventas_rapidas.cobrando")
                    : t("ventas_rapidas.confirmar_cobro")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
