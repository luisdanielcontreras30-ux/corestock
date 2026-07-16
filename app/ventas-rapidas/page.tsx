"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Zap,
  ArrowLeft,
  Banknote,
  CreditCard,
  ArrowLeftRight,
  HandCoins,
  Wallet,
} from "lucide-react";
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

const METODOS: MetodoPago[] = ["efectivo", "tarjeta", "transferencia", "prestamo"];

const ICONO_METODO: Record<MetodoPago, typeof Banknote> = {
  efectivo: Banknote,
  tarjeta: CreditCard,
  transferencia: ArrowLeftRight,
  prestamo: HandCoins,
  otro: Wallet,
};

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
  const [nombreClientePrestamo, setNombreClientePrestamo] = useState("");
  const [cobrando, setCobrando] = useState(false);

  // El panel de cobro se monta con un portal a document.body: así queda
  // realmente fijo a la pantalla completa incluso dentro de <main
  // className="fade-up">, cuyo transform de animación crea un nuevo
  // "containing block" para position:fixed y recortaba el panel.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

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
    setNombreClientePrestamo("");
    setPanelAbierto(true);
  }

  const recibidoNum = Number(recibido) || 0;
  const cambio = recibidoNum - totalCarrito;
  const faltaRecibido = metodoPago === "efectivo" && recibidoNum < totalCarrito;
  const faltaCliente = metodoPago === "prestamo" && nombreClientePrestamo.trim() === "";

  async function confirmarCobro() {
    if (cobrando) return;

    if (faltaRecibido) {
      mostrarToast(t("ventas_rapidas.msg_recibido_insuficiente"), "error");
      return;
    }

    if (faltaCliente) {
      mostrarToast(t("ventas_rapidas.msg_cliente_obligatorio"), "error");
      return;
    }

    try {
      setCobrando(true);
      await registrarVentaRapida(
        itemsCarrito,
        metodoPago,
        metodoPago === "prestamo" ? nombreClientePrestamo.trim() : ""
      );
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
              <Search size={22} color="var(--text-secondary)" />
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
                  fontSize: 17,
                }}
              >
                <p>
                  {productos.length === 0
                    ? t("ventas_rapidas.sin_productos_catalogo")
                    : t("ventas_rapidas.sin_productos")}
                </p>
                {productos.length === 0 && (
                  <Link href="/productos" className="btn-primary" style={{ display: "inline-block", marginTop: 12 }}>
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
                          <ShoppingCart size={34} color="var(--text-muted)" />
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
                <ShoppingCart size={24} /> {t("ventas_rapidas.carrito_titulo")}
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
                  fontSize: 16,
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
                        <Minus size={20} />
                      </button>
                      <span>{item.cantidad}</span>
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(item.producto.id, 1)}
                        aria-label="+"
                      >
                        <Plus size={20} />
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
                      <Trash2 size={22} />
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

      {panelAbierto &&
        montado &&
        createPortal(
          <div className="venta-rapida-panel-overlay">
            <div className="venta-rapida-panel-full fade-up">
              <div className="venta-rapida-panel-header">
                <button
                  className="venta-rapida-panel-cerrar"
                  onClick={() => setPanelAbierto(false)}
                  disabled={cobrando}
                  aria-label={t("ventas_rapidas.cancelar")}
                >
                  <ArrowLeft size={22} />
                </button>
                <h3>{t("ventas_rapidas.panel_titulo")}</h3>
                <span style={{ width: 44 }} />
              </div>

              <div className="venta-rapida-panel-body">
                <div className="venta-rapida-monto-box">
                  <span>{t("ventas_rapidas.monto_a_pagar")}</span>
                  <strong>{formatoMoneda(totalCarrito)}</strong>
                </div>

                <div className="venta-rapida-metodos">
                  {METODOS.map((metodo) => {
                    const Icono = ICONO_METODO[metodo];
                    return (
                      <button
                        key={metodo}
                        type="button"
                        className={
                          metodoPago === metodo ? "btn-primary" : "btn-secondary"
                        }
                        onClick={() => setMetodoPago(metodo)}
                      >
                        <Icono size={26} />
                        {t(CLAVE_METODO_PAGO[metodo])}
                      </button>
                    );
                  })}
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

                {metodoPago === "prestamo" && (
                  <div className="venta-rapida-efectivo">
                    <div>
                      <label>
                        {t("ventas_rapidas.nombre_cliente")}{" "}
                        <span className="venta-rapida-obligatorio">*</span>
                      </label>
                      <input
                        type="text"
                        value={nombreClientePrestamo}
                        onChange={(e) => setNombreClientePrestamo(e.target.value)}
                        placeholder={t("ventas_rapidas.nombre_cliente_placeholder")}
                        autoFocus
                      />
                    </div>
                    <p className="venta-rapida-nota-prestamo">
                      {t("ventas_rapidas.nota_prestamo")}
                    </p>
                  </div>
                )}
              </div>

              <div className="venta-rapida-panel-footer">
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
                  disabled={cobrando || faltaRecibido || faltaCliente}
                >
                  {cobrando
                    ? t("ventas_rapidas.cobrando")
                    : t("ventas_rapidas.confirmar_cobro")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </main>
  );
}
