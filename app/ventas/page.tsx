"use client";

import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";
import Historial from "./Historial";
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
import { useConfirm } from "../../components/ConfirmProvider";
import { useToast } from "../../components/ToastProvider";
import { useMiembroActivo } from "../../components/MiembroActivoProvider";
import SinPermiso from "../../components/SinPermiso";
import { obtenerPromocionAplicable, calcularPrecioConDescuento } from "../../lib/promociones";

export default function VentasPage() {
  const { t } = useIdioma();
  const { confirmar } = useConfirm();
  const { mostrarToast } = useToast();
  const { puede } = useMiembroActivo();
  const [loading, setLoading] = useState(true);

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

      await registrarVenta(producto, cliente, cantidad, clienteNombre, precioUnitario, metodoPago);

      setProductoId("");
      setClienteId("");
      setClienteNombre("");
      setCantidad(1);
      setMetodoPago("efectivo");

      mostrarToast(t("ventas.msg_venta_registrada"), "exito");
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = error instanceof Error ? error.message : "";
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
      const detalle = error instanceof Error ? error.message : "";
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
        <div className="card">{t("header.cargando")}</div>
      ) : (
        <Historial
          ventas={ventas}
          eliminarVenta={puede("eliminar_ventas") ? borrarVenta : undefined}
          exportarExcel={puede("exportar_datos") ? () => exportarExcel(ventas) : undefined}
        />
      )}
    </main>
  );
}
