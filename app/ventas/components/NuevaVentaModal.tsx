"use client";

import { useEffect, useState } from "react";
import VentaForm from "./VentaForm";
import { cargarDatos, registrarVenta } from "../acciones";
import { Producto, Cliente } from "../types";
import { useIdioma } from "../../../components/LanguageProvider";

interface Props {
  onClose: () => void;
}

export default function NuevaVentaModal({ onClose }: Props) {
  const { t } = useIdioma();
  const [loading, setLoading] = useState(true);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [productoId, setProductoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarDatos().then((datos) => {
      setProductos(datos.productos);
      setClientes(datos.clientes);
      setLoading(false);
    });
  }, []);

  const producto = productos.find(
    (p) => p.id === Number(productoId)
  );

  const cliente =
    clientes.find((c) => c.id === Number(clienteId)) ?? null;

  const total = producto ? producto.precio_venta * cantidad : 0;

  function alCambiarClienteNombre(nombre: string) {
    setClienteNombre(nombre);

    const encontrado = clientes.find(
      (c) => c.nombre.toLowerCase() === nombre.toLowerCase()
    );

    setClienteId(encontrado ? encontrado.id.toString() : "");
  }

  async function guardarVenta() {
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
      await registrarVenta(producto, cliente, cantidad, clienteNombre);
      onClose();
    } catch (error) {
      console.error(error);
      alert(t("ventas.msg_error_registrar"));
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
              total={total}
              guardando={guardando}
              onGuardar={guardarVenta}
            />
          )}
        </div>
      </div>
    </div>
  );
}
