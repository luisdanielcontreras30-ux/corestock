"use client";

import { Producto, Cliente } from "../types";

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
  return (
    <div className="card">
      <h2 style={{ marginBottom: 20 }}>Registrar Venta</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
          gap: 18,
        }}
      >
        <div>
          <label>Producto</label>

          <select
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
          >
            <option value="">Selecciona un producto</option>

            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Cliente</label>

          <input
            type="text"
            list="lista-clientes"
            placeholder="Buscar cliente..."
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
          <label>Cantidad</label>

          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
          />
        </div>

        <div>
          <label>Total</label>

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
          <strong>Stock disponible:</strong> {producto.stock}
          <br />
          <strong>Precio:</strong> ${producto.precio_venta.toFixed(2)}
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
          {guardando ? "Guardando..." : "Registrar Venta"}
        </button>
      </div>
    </div>
  );
}
