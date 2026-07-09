"use client";

import { Suspense, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, BarChart3, Zap } from "lucide-react";

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginInterno />
    </Suspense>
  );
}

function LoginInterno() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modoInicial =
    searchParams.get("modo") === "registro" ? "registro" : "login";

  const [modo, setModo] = useState<"login" | "registro">(modoInicial);
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function iniciarSesion() {
    setError("");
    setMensaje("");

    if (!correo || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }

    setCargando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: correo,
      password,
    });

    if (error) {
      setError(traducirError(error.message));
      setCargando(false);
      return;
    }

    router.push("/");
  }

  async function registrarse() {
    setError("");
    setMensaje("");

    if (!correo || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setCargando(true);

    const { error } = await supabase.auth.signUp({
      email: correo,
      password,
    });

    if (error) {
      setError(traducirError(error.message));
      setCargando(false);
      return;
    }

    setMensaje("Cuenta creada. Revisa tu correo para confirmarla.");
    setCargando(false);
  }

  function traducirError(msg: string): string {
    if (msg.includes("Invalid login credentials")) {
      return "Correo o contraseña incorrectos.";
    }
    if (msg.includes("already registered")) {
      return "Ese correo ya está registrado.";
    }
    return msg;
  }

  function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (modo === "login") {
      iniciarSesion();
    } else {
      registrarse();
    }
  }

  return (
    <main className="login-page">
      {/* PANEL IZQUIERDO: BRANDING */}
      <div className="login-brand-panel">
        <div className="login-blob login-blob-1" />
        <div className="login-blob login-blob-2" />

        <div className="login-brand-content fade-up">
          <div className="login-brand-logo">⬢</div>
          <h1>CoreStock</h1>
          <p>
            Controla tu inventario, tus ventas y tu crecimiento
            desde un solo lugar, con estadísticas en tiempo real.
          </p>

          <ul className="login-brand-list">
            <li><Package size={15} /> Inventario con imágenes por producto</li>
            <li><BarChart3 size={15} /> Gráficas de ventas Semanal / Mensual / Anual</li>
            <li><Zap size={15} /> Importa y exporta tu catálogo en Excel</li>
          </ul>
        </div>
      </div>

      {/* PANEL DERECHO: FORMULARIO */}
      <div className="login-form-panel">
        <form
          className="login-card fade-up"
          onSubmit={alEnviar}
        >
          <h1>{modo === "login" ? "Bienvenido de vuelta" : "Crea tu cuenta"}</h1>

          <p>
            {modo === "login"
              ? "Inicia sesión para continuar"
              : "Empieza a organizar tu inventario"}
          </p>

          {error && <div className="login-alert login-alert-error">{error}</div>}
          {mensaje && (
            <div className="login-alert login-alert-success">{mensaje}</div>
          )}

          <label className="login-label">Correo electrónico</label>
          <input
            type="email"
            placeholder="tucorreo@ejemplo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />

          <label className="login-label">Contraseña</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="btn-login" disabled={cargando} type="submit">
            {cargando ? (
              <span className="login-spinner" />
            ) : modo === "login" ? (
              "Iniciar sesión"
            ) : (
              "Registrarse"
            )}
          </button>

          <button
            className="btn-register"
            type="button"
            disabled={cargando}
            onClick={() => {
              setModo(modo === "login" ? "registro" : "login");
              setError("");
              setMensaje("");
            }}
          >
            {modo === "login"
              ? "¿No tienes cuenta? Regístrate"
              : "¿Ya tienes cuenta? Inicia sesión"}
          </button>
        </form>
      </div>
    </main>
  );
}
