"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);

  async function iniciarSesion() {
    setCargando(true);

    const { error } =
      await supabase.auth.signInWithPassword({
        email: correo,
        password,
      });

    if (error) {
      alert(error.message);
      setCargando(false);
      return;
    }

    router.push("/");
  }

  async function registrarse() {
    setCargando(true);

    const { error } =
      await supabase.auth.signUp({
        email: correo,
        password,
      });

    if (error) {
      alert(error.message);
      setCargando(false);
      return;
    }

    alert("Cuenta creada correctamente.");

    setCargando(false);
  }

  return (
    <main className="login">
      <div className="login-card">

        <img
          src="/logo.png"
          alt="CoreStock"
          className="logo-login"
        />

        <h1>CoreStock</h1>

        <p>
          Sistema Inteligente de Inventario
        </p>

        <input
          type="email"
          placeholder="Correo electrónico"
          value={correo}
          onChange={(e) =>
            setCorreo(e.target.value)
          }
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
        />

        <button
          className="btn-login"
          onClick={iniciarSesion}
          disabled={cargando}
        >
          {cargando
            ? "Cargando..."
            : "Iniciar sesión"}
        </button>

        <button
          className="btn-register"
          onClick={registrarse}
          disabled={cargando}
        >
          Registrarse
        </button>

      </div>
    </main>
  );
}