"use client";

import { useEffect, useState } from "react";
import Historial from "./Historial";

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
} from "./types";

export default function VentasPage() {
  const [loading, setLoading] = useState(true);

  const [productos, setProductos] =
    useState<Producto[]>([]);

  const [clientes, setClientes] =
    useState<Cliente[]>([]);

  const [ventas, setVentas] =
    useState<Venta[]>([]);

  const [productoId, setProductoId] =
    useState("");

  const [clienteId, setClienteId] =
    useState("");

    const [clienteNombre, setClienteNombre] =
  useState("");

  const [cantidad, setCantidad] =
    useState(1);

  const [guardando, setGuardando] =
    useState(false);

  async function obtenerDatos() {
    setLoading(true);

    const datos = await cargarDatos();

    setProductos(datos.productos);
    setClientes(datos.clientes);
    setVentas(datos.ventas);

    setLoading(false);
  }

  useEffect(() => {
    obtenerDatos();
  }, []);

  const producto = productos.find(
    (p) => p.id === Number(productoId)
  );

  const cliente =
    clientes.find(
      (c) => c.id === Number(clienteId)
    ) ?? null;

  const total = producto
    ? producto.precio_venta * cantidad
    : 0;

  async function guardarVenta() {
    if (!producto) {
      alert("Selecciona un producto.");
      return;
    }

    if (cantidad <= 0) {
      alert("La cantidad debe ser mayor a 0.");
      return;
    }

    if (cantidad > producto.stock) {
      alert("No hay suficiente stock.");
      return;
    }

    try {
      setGuardando(true);

     await registrarVenta(
    producto,
    cliente,
    cantidad,
    clienteNombre
  );

  setProductoId("");
  setClienteId("");
  setClienteNombre("");
  setCantidad(1);

  await obtenerDatos();

    } catch (error) {
      console.error(error);
      alert("No se pudo registrar la venta.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrarVenta(id: number) {
    if (!confirm("¿Eliminar esta venta?")) {
      return;
    }

    try {
      await eliminarVenta(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert("No se pudo eliminar.");
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
      <div>
        <h1
          style={{
            fontSize: 34,
            fontWeight: 700,
          }}
        >
          Ventas
        </h1>

        <p
          style={{
            color: "var(--text-secondary)",
          }}
        >
          Registra ventas y consulta el historial.
        </p>
      </div>

      <div className="card">

        <h2
          style={{
            marginBottom: 20,
          }}
        >
          Registrar Venta
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2,minmax(0,1fr))",
            gap: 18,
          }}
        >
          <div>
            <label>Producto</label>

            <select
              value={productoId}
              onChange={(e) =>
                setProductoId(
                  e.target.value
                )
              }
            >
              <option value="">
                Selecciona un producto
              </option>

              {productos.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                >
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
    onChange={(e) => {
      const nombre = e.target.value;

      setClienteNombre(nombre);

      const encontrado = clientes.find(
        (c) =>
          c.nombre.toLowerCase() ===
          nombre.toLowerCase()
      );

      setClienteId(
        encontrado
          ? encontrado.id.toString()
          : ""
      );
    }}
  />

  <datalist id="lista-clientes">
    {clientes.map((c) => (
      <option
        key={c.id}
        value={c.nombre}
      />
    ))}
  </datalist>
</div>

          <div>
            <label>Cantidad</label>

            <input
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) =>
                setCantidad(
                  Number(e.target.value)
                )
              }
            />
          </div>

          <div>
            <label>Total</label>

            <input
              readOnly
              value={`$${total.toFixed(2)}`}
            />
          </div>
        </div>

        {producto && (
          <div
            style={{
              marginTop: 20,
              padding: 16,
              borderRadius: 10,
              background:
                "rgba(255,255,255,.03)",
            }}
          >
            <strong>
              Stock disponible:
            </strong>{" "}
            {producto.stock}

            <br />

            <strong>
              Precio:
            </strong>{" "}
            ${producto.precio_venta.toFixed(2)}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent:
              "flex-end",
            marginTop: 24,
          }}
        >
          <button
            className="btn-primary"
            disabled={guardando}
            onClick={guardarVenta}
          >
            {guardando
              ? "Guardando..."
              : "Registrar Venta"}
          </button>
        </div>

      </div>      {loading ? (
        <div className="card">
          Cargando...
        </div>
      ) : (
        <Historial
          ventas={ventas}
          eliminarVenta={borrarVenta}
          exportarExcel={() =>
            exportarExcel(ventas)
          }
        />
      )}
    </main>
  );
}