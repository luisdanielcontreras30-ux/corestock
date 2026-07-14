"use client";

import { useEffect, useState } from "react";
import VentaForm from "./VentaForm";
import { cargarDatos, registrarVenta } from "../acciones";
import { Producto, Cliente, Promocion, MetodoPago } from "../types";
import { useIdioma } from "../../../components/LanguageProvider";
import { obtenerPromocionAplicable, calcularPrecioConDescuento } from "../../../lib/promociones";

interface Props {
  onClose: () => void;
}

export default function NuevaVentaModal({ onClose }: Props) {
  const { t } = useIdioma();
  const [loading, setLoading] = useState(true);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [promociones, setPromociones] = useState<Promocion[]>([]);

  const [productoId, setProductoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarDatos().then((datos) => {
      setProductos(datos.productos);
      setClientes(datos.clientes);
      setPromociones(datos.promociones);
      setLoading(false);
    });
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
      onClose();
    } catch (error) {
      console.error(error);
      const detalle = error instanceof Error ? error.message : "";
      alert(detalle || t("ventas.msg_error_registrar"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="factura-overlay" onClick={onClose}>
      <div
        className="factura-modal fade-up"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="factura-modal-toolbar">
          <button className="btn-secondary" onClick={onClose}>
            {t("factura.cerrar")}
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {loading ? (
            <p style={{ textAlign: "center", padding: 20 }}>
              {t("header.cargando")}
            </p>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
