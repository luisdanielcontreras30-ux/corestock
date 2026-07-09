"use client";

import { Producto, Cliente } from "../types";
import { useIdioma } from "../../../components/LanguageProvider";

interface Props {
  productos: Producto[];
  clientes: Cliente[];
  producto: Producto | undefined;
  productoId: string;
  setProductoId: (v: string) => void;
  clienteNombre: string;
  setClienteNombre: (v: string) => void;
  cantidad: number;
  setCantidad: (v: number) => void;
  total: number;
  guardando: boolean;
  onGuardar: () => void;
}

export default function VentaForm({
  productos,
  clientes,
  producto,
  productoId,
  setProductoId,
  clienteNombre,
  setClienteNombre,
  cantidad,
  setCantidad,
  total,
  guardando,
  onGuardar,
}: Props) {
  const { t } = useIdioma();

  return (
    <div className="card">
      <h2 style={{ marginBottom: 20 }}>{t("ventas.registrar_venta")}</h2>

      <div className="form-grid-2col">
        <div>
          <label>{t("tabla.producto")}</label>

          <select
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
          >
            <option value="">{t("ventas.selecciona_producto")}</option>

            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>{t("ventas.cliente")}</label>

          <input
            type="text"
            list="lista-clientes"
            placeholder={t("ventas.buscar_cliente")}
            value={clienteNombre}
            onChange={(e) => setClienteNombre(e.target.value)}
          />

          <datalist id="lista-clientes">
            {clientes.map((c) => (
              <option key={c.id} value={c.nombre} />
            ))}
          </datalist>
        </div>

        <div>
          <label>{t("tabla.cantidad")}</label>

          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
          />
        </div>

        <div>
          <label>{t("tabla.total")}</label>

          <input readOnly value={`$${total.toFixed(2)}`} />
        </div>
      </div>

      {producto && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 10,
            background: "var(--glass-bg)",
          }}
        >
          <strong>{t("ventas.stock_disponible")}:</strong> {producto.stock}
          <br />
          <strong>{t("productos.precio")}:</strong> ${producto.precio_venta.toFixed(2)}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 24,
        }}
      >
        <button
          className="btn-primary"
          disabled={guardando}
          onClick={onGuardar}
        >
          {guardando ? t("ventas.guardando") : t("ventas.registrar_venta")}
        </button>
      </div>
    </div>
  );
}
