"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Alertas() {
  const [alertas, setAlertas] = useState<any[]>([]);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data } = await supabase
      .from("productos")
      .select("*")
      .eq("user_id", user.id)
      .lte("stock", 5)
      .order("stock");

    if (data) {
      setAlertas(data);
    }
  }

  const agotados = alertas.filter(
    (p) => p.stock === 0
  ).length;

  return (
    <main className="container">

      <a href="/menu" className="menu-btn">
        ← Menú
      </a>

      <h1>Alertas</h1>

      <div className="estadisticas">

        <div className="estadistica">
          <h3>Alertas</h3>
          <span>{alertas.length}</span>
        </div>

        <div className="estadistica">
          <h3>Agotados</h3>
          <span>{agotados}</span>
        </div>

      </div>

      <div className="grid">

        {alertas.length === 0 ? (
          <div className="card">
            <h3>✅ Todo bien</h3>
            <p>
              No hay productos con stock bajo.
            </p>
          </div>
        ) : (
          alertas.map((producto) => (
            <div
              className="card"
              key={producto.id}
            >
              <h3>{producto.nombre}</h3>

              <p>
                Categoría: {producto.categoria}
              </p>

              <p>
                Stock: {producto.stock}
              </p>

              {producto.stock === 0 ? (
                <p className="agotado">
                  ❌ Producto agotado
                </p>
              ) : (
                <p className="alerta">
                  ⚠ Stock bajo
                </p>
              )}
            </div>
          ))
        )}

      </div>

    </main>
  );
}