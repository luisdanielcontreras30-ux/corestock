"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Historial() {
  const [ventas, setVentas] = useState<any[]>([]);

  useEffect(() => {
    cargarVentas();
  }, []);

  async function cargarVentas() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data } = await supabase
      .from("ventas")
      .select("*")
      .eq("user_id", user.id)
      .order("fecha", {
        ascending: false,
      });

    if (data) {
      setVentas(data);
    }
  }

  return (
    <main className="container">

      <a
        href="/menu"
        className="menu-btn"
      >
        ← Menú
      </a>

      <h1>Historial de Ventas</h1>

      <div className="grid">

        {ventas.map((venta) => (
          <div
            className="card"
            key={venta.id}
          >
            <h3>
              {venta.producto}
            </h3>

            <p>
              Cantidad:
              {" "}
              {venta.cantidad}
            </p>

            <p>
              Precio:
              {" "}
              ${venta.precio}
            </p>

            <p>
              Total:
              {" "}
              ${venta.total}
            </p>

            <p>
              📅 Fecha:
              {" "}
              {new Date(
                venta.fecha
              ).toLocaleDateString()}
            </p>

            <p>
              🕒 Hora:
              {" "}
              {new Date(
                venta.fecha
              ).toLocaleTimeString()}
            </p>
          </div>
        ))}

      </div>

    </main>
  );
}