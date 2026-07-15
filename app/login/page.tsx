"use client";

import { Suspense, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, BarChart3, Zap } from "lucide-react";
import { useMiembroActivo } from "../../components/MiembroActivoProvider";
import { entrarComoMiembro, RazonLoginMiembro } from "../configuracion/acciones";

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
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const { establecerMiembroActivo, limpiarMiembroActivo } = useMiembroActivo();

  async function iniciarSesion() {
    setError("");
    setMensaje("");

    if (!correo || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }

    const nombreUsuario = usuario.trim();

    setCargando(true);

    // Sin nombre de usuario, entra como el dueño de la cuenta (sin
    // restricciones) con su correo y contraseña, como siempre.
    if (!nombreUsuario) {
      const { error } = await supabase.auth.signInWithPassword({
        email: correo,
        password,
      });

      if (error) {
        setError(traducirError(error.message));
        setCargando(false);
        return;
      }

      limpiarMiembroActivo();
      router.push("/");
      return;
    }

    // Con un nombre de usuario, la contraseña escrita es la del
    // miembro (no la de la cuenta) — nunca necesita la contraseña
    // principal. Se valida en el servidor y, si coincide, se abre
    // sesión con el token que devuelve en vez de un signInWithPassword.
    try {
      const resultado = await entrarComoMiembro(correo, nombreUsuario, password);

      if (!resultado.ok) {
        setError(traducirRazonLoginMiembro(resultado.razon));
        setCargando(false);
        return;
      }

      const { error: errorOtp } = await supabase.auth.verifyOtp({
        token_hash: resultado.tokenHash,
        type: "magiclink",
      });

      if (errorOtp) {
        console.error(errorOtp);
        setError("No se pudo iniciar sesión. Intenta de nuevo.");
        setCargando(false);
        return;
      }

      establecerMiembroActivo(resultado.miembro, resultado.userId);
      router.push("/");
    } catch (err) {
      console.error(err);
      setError("No se pudo iniciar sesión. Intenta de nuevo.");
      setCargando(false);
    }
  }

  function traducirRazonLoginMiembro(razon: RazonLoginMiembro): string {
    if (razon === "cuenta_no_encontrada") return "No encontramos una cuenta con ese correo.";
    if (razon === "no_encontrado") return "Este usuario no existe.";
    if (razon === "sin_contrasena") return "Este usuario todavía no tiene contraseña. Pide al dueño que te asigne una en Miembros del equipo.";
    return "Usuario o contraseña incorrectos.";
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

    if (password !== confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setCargando(true);

    const { data, error } = await supabase.auth.signUp({
      email: correo,
      password,
    });

    if (error) {
      setError(traducirError(error.message));
      setCargando(false);
      return;
    }

    // Si Supabase ya regresó una sesión activa (confirmación de correo
    // desactivada en el proyecto), entra directo sin pedir que confirme.
    if (data.session) {
      router.push("/menu");
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

          {modo === "login" && (
            <>
              <label className="login-label">
                Usuario <span className="login-label-opcional">(opcional, solo para tu equipo)</span>
              </label>
              <input
                type="text"
                placeholder="Tu nombre, si el dueño te agregó al equipo"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
              />
            </>
          )}

          <label className="login-label">Contraseña</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {modo === "registro" && (
            <>
              <label className="login-label">Confirmar contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
              />
            </>
          )}

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
              setConfirmarPassword("");
              setUsuario("");
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
