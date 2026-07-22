"use client";

import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";
import Historial from "./Historial";
import { mensajeErrorSeguro } from "../../lib/errores";
import VentaForm from "./components/VentaForm";
import EncabezadoModulo from "../../components/EncabezadoModulo";

import {
  cargarDatos,
  registrarVenta,
  eliminarVenta,
} from "./acciones";

import { exportarExcel } from "./utils";

import {
  Producto,
  Cliente,
  Venta,
  Promocion,
  MetodoPago,
} from "./types";
import { useIdioma } from "../../components/LanguageProvider";
import { useAuth } from "../../components/AuthProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import { useToast } from "../../components/ToastProvider";
import { useMiembroActivo } from "../../components/MiembroActivoProvider";
import { useSuscripcion } from "../../components/SuscripcionProvider";
import SinPermiso from "../../components/SinPermiso";
import TicketModal, { ItemTicket } from "./components/TicketModal";
import { obtenerPromocionAplicable, calcularPrecioConDescuento } from "../../lib/promociones";
import { guardarBorrador, leerBorrador, borrarBorrador } from "../../lib/borrador";

const CLAVE_BORRADOR = "corestock-borrador-venta";

interface BorradorVenta {
  productoId: string;
  clienteId: string;
  clienteNombre: string;
  cantidad: number;
  metodoPago: MetodoPago;
}

interface TicketPendiente {
  folioId: number;
  fecha: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  metodoPago: MetodoPago;
  items: ItemTicket[];
  total: number;
}

export default function VentasPage() {
  const { t } = useIdioma();
  const { user } = useAuth();
  const { confirmar } = useConfirm();
  const { mostrarToast } = useToast();
  const { puede } = useMiembroActivo();
  const { esPlus } = useSuscripcion();
  // Sufijado con el id de quien tiene la sesión — sin esto, dos cuentas
  // de negocio distintas que compartan el mismo navegador (ej. una
  // terminal de venta) verían y sobrescribirían el borrador de la otra.
  const claveBorrador = user ? `${CLAVE_BORRADOR}-${user.id}` : null;

  // acciones.ts lanza sentinels sin traducir (ver comentario en
  // lib/errores.ts) para los casos donde sí hay un mensaje pensado
  // para mostrarse — esta función los traduce; null si el error no es
  // ninguno de los esperados (deja pasar a mensajeErrorSeguro/fallback).
  function mensajeVenta(error: unknown): string | null {
    if (!(error instanceof Error)) return null;
    switch (error.message) {
      case "CLIENTE_OBLIGATORIO":
        return t("ventas_rapidas.msg_cliente_obligatorio");
      case "CANTIDAD_INVALIDA":
        return t("ventas.msg_cantidad_mayor");
      case "SIN_STOCK":
        return t("ventas.msg_sin_stock");
      case "PRECIO_INVALIDO":
        return t("ventas.msg_precio_invalido");
      case "STOCK_CAMBIO":
        return t("comun.msg_stock_cambio");
      default:
        return null;
    }
  }
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<TicketPendiente | null>(null);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [promociones, setPromociones] = useState<Promocion[]>([]);

  const [productoId, setProductoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [guardando, setGuardando] = useState(false);

  async function obtenerDatos() {
    setLoading(true);

    try {
      const datos = await cargarDatos();

      setProductos(datos.productos);
      setClientes(datos.clientes);
      setVentas(datos.ventas);
      setPromociones(datos.promociones);
    } catch (error) {
      console.error(error);
      mostrarToast(t("comun.msg_error_cargar_datos"), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    obtenerDatos();
  }, []);

  // Recupera lo que ya se había llenado del formulario de venta si la
  // página se recargó a medio capturar.
  useEffect(() => {
    if (!claveBorrador) return;

    const borrador = leerBorrador<BorradorVenta>(claveBorrador);
    if (!borrador) return;

    setProductoId(borrador.productoId);
    setClienteId(borrador.clienteId);
    setClienteNombre(borrador.clienteNombre);
    setCantidad(borrador.cantidad);
    setMetodoPago(borrador.metodoPago);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveBorrador]);

  useEffect(() => {
    if (!claveBorrador) return;

    const vacio = !productoId && !clienteId && !clienteNombre && cantidad === 1 && metodoPago === "efectivo";

    if (vacio) {
      borrarBorrador(claveBorrador);
      return;
    }

    guardarBorrador<BorradorVenta>(claveBorrador, {
      productoId,
      clienteId,
      clienteNombre,
      cantidad,
      metodoPago,
    });
  }, [claveBorrador, productoId, clienteId, clienteNombre, cantidad, metodoPago]);

  const producto = productos.find(
    (p) => p.id === Number(productoId)
  );

  const cliente =
    clientes.find((c) => c.id === Number(clienteId)) ?? null;

  const promoAplicable = producto
    ? obtenerPromocionAplicable(producto.id, promociones)
    : null;

  const precioUnitario = producto
    ? calcularPrecioConDescuento(producto.precio_venta, promoAplicable)
    : 0;

  const total = precioUnitario * cantidad;

  function alCambiarClienteNombre(nombre: string) {
    setClienteNombre(nombre);

    const encontrado = clientes.find(
      (c) => c.nombre.toLowerCase() === nombre.toLowerCase()
    );

    setClienteId(encontrado ? encontrado.id.toString() : "");
  }

  async function guardarVenta() {
    if (guardando) return;

    if (!producto) {
      mostrarToast(t("ventas.msg_selecciona_producto"), "error");
      return;
    }

    if (cantidad <= 0) {
      mostrarToast(t("ventas.msg_cantidad_mayor"), "error");
      return;
    }

    if (!Number.isInteger(cantidad)) {
      mostrarToast(t("comun.msg_cantidad_entera"), "error");
      return;
    }

    if (cantidad > producto.stock) {
      mostrarToast(t("ventas.msg_sin_stock"), "error");
      return;
    }

    if (metodoPago === "prestamo" && clienteNombre.trim() === "") {
      mostrarToast(t("ventas_rapidas.msg_cliente_obligatorio"), "error");
      return;
    }

    try {
      setGuardando(true);

      const resultado = await registrarVenta(
        producto,
        cliente,
        cantidad,
        clienteNombre,
        precioUnitario,
        metodoPago
      );

      if (esPlus && resultado) {
        setTicket({
          folioId: resultado.id,
          fecha: new Date().toISOString(),
          clienteNombre: cliente?.nombre || clienteNombre.trim() || t("ventas.cliente_general"),
          clienteTelefono: cliente?.telefono ?? null,
          metodoPago,
          items: [
            {
              producto: producto.nombre,
              cantidad,
              precioUnitario,
              total,
            },
          ],
          total,
        });
      }

      setProductoId("");
      setClienteId("");
      setClienteNombre("");
      setCantidad(1);
      setMetodoPago("efectivo");
      if (claveBorrador) borrarBorrador(claveBorrador);

      mostrarToast(t("ventas.msg_venta_registrada"), "exito");
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = mensajeVenta(error) || mensajeErrorSeguro(error);
      mostrarToast(detalle || t("ventas.msg_error_registrar"), "error");
    } finally {
      setGuardando(false);
    }
  }

  async function borrarVenta(id: number) {
    if (!(await confirmar(t("ventas.confirmar_eliminar"), { peligroso: true }))) {
      return;
    }

    try {
      await eliminarVenta(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = mensajeVenta(error) || mensajeErrorSeguro(error);
      mostrarToast(`${t("ventas.msg_error_eliminar")}${detalle ? ": " + detalle : ""}`, "error");
    }
  }

  if (!puede("ver_ventas")) {
    return (
      <main
        className="fade-up"
        style={{ display: "flex", flexDirection: "column", gap: 24 }}
      >
        <EncabezadoModulo
          Icono={DollarSign}
          color="#10b981"
          titulo={t("ventas.titulo")}
          subtitulo={t("ventas.subtitulo")}
        />
        <SinPermiso />
      </main>
    );
  }

  return (
    <main
      className="fade-up"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <EncabezadoModulo
        Icono={DollarSign}
        color="#10b981"
        titulo={t("ventas.titulo")}
        subtitulo={t("ventas.subtitulo")}
      />

      {puede("registrar_ventas") && (
        <div className="ventas-form-desktop">
          <VentaForm
            productos={productos}
            clientes={clientes}
            producto={producto}
            productoId={productoId}
            setProductoId={setProductoId}
            clienteNombre={clienteNombre}
            setClienteNombre={alCambiarClienteNombre}
            cantidad={cantidad}
            setCantidad={setCantidad}
            metodoPago={metodoPago}
            setMetodoPago={setMetodoPago}
            total={total}
            precioUnitario={precioUnitario}
            promocion={promoAplicable}
            guardando={guardando}
            onGuardar={guardarVenta}
          />
        </div>
      )}

      {loading ? (
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="skeleton" style={{ width: 180, height: 22, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: 240, height: 14, borderRadius: 4 }} />
            </div>
            <div className="skeleton" style={{ width: 130, height: 38, borderRadius: 10 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 52, borderRadius: 10, animationDelay: `${i * 0.06}s` }}
              />
            ))}
          </div>
        </div>
      ) : (
        <Historial
          ventas={ventas}
          eliminarVenta={puede("eliminar_ventas") ? borrarVenta : undefined}
          exportarExcel={puede("exportar_datos") ? () => exportarExcel(ventas) : undefined}
        />
      )}

      {ticket && <TicketModal {...ticket} onClose={() => setTicket(null)} />}
    </main>
  );
}
