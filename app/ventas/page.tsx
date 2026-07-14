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
import { obtenerPromocionAplicable, calcularPrecioConDescuento } from "../../lib/promociones";

export default function VentasPage() {
  const { t } = useIdioma();
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
      alert(t("comun.msg_error_cargar_datos"));
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
      alert(t("ventas.msg_selecciona_producto"));
      return;
    }

    if (cantidad <= 0) {
      alert(t("ventas.msg_cantidad_mayor"));
      return;
    }

    if (cantidad > producto.stock) {
      alert(t("ventas.msg_sin_stock"));
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

      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = error instanceof Error ? error.message : "";
      alert(detalle || t("ventas.msg_error_registrar"));
    } finally {
      setGuardando(false);
    }
  }

  async function borrarVenta(id: number) {
    if (!confirm(t("ventas.confirmar_eliminar"))) {
      return;
    }

    try {
      await eliminarVenta(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = error instanceof Error ? error.message : "";
      alert(`${t("ventas.msg_error_eliminar")}${detalle ? ": " + detalle : ""}`);
    }
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

      {loading ? (
        <div className="card">{t("header.cargando")}</div>
      ) : (
        <Historial
          ventas={ventas}
          eliminarVenta={borrarVenta}
          exportarExcel={() => exportarExcel(ventas)}
        />
      )}
    </main>
  );
}
