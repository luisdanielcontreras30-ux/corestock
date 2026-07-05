"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function Cuenta() {
  const [correo, setCorreo] = useState("Cargando...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    obtenerUsuario();
  }, []);

  async function obtenerUsuario() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setCorreo(user.email || "Sin correo");
    } else {
      setCorreo("No has iniciado sesión");
    }

    setLoading(false);
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="container">
      <Link href="/menu" className="menu-btn">
        ← Menú
      </Link>

      <h1>Cuenta</h1>

      <div className="cuenta-card">
        <h2>Correo</h2>

        {loading ? (
          <p>Cargando...</p>
        ) : (
          <p className="correo">{correo}</p>
        )}

        <button className="logout-btn" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}