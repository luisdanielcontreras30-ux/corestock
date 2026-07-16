"use client";

import { Suspense, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, BarChart3, Zap } from "lucide-react";
import { useMiembroActivo } from "../../components/MiembroActivoProvider";
import { entrarComoMiembro, RazonLoginMiembro } from "../configuracion/acciones";
import { useIdioma } from "../../components/LanguageProvider";

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
  const { t } = useIdioma();

  async function iniciarSesion() {
    setError("");
    setMensaje("");

    if (!correo || !password) {
      setError(t("login.msg_faltan_campos"));
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
        setError(t("login.error_generico"));
        setCargando(false);
        return;
      }

      establecerMiembroActivo(resultado.miembro, resultado.userId);
      router.push("/");
    } catch (err) {
      console.error(err);
      setError(t("login.error_generico"));
      setCargando(false);
    }
  }

  function traducirRazonLoginMiembro(razon: RazonLoginMiembro): string {
    if (razon === "no_encontrado") return t("login.razon_no_encontrado");
    if (razon === "sin_contrasena") return t("login.razon_sin_contrasena");
    return t("login.razon_incorrecto");
  }

  async function registrarse() {
    setError("");
    setMensaje("");

    if (!correo || !password) {
      setError(t("login.msg_faltan_campos"));
      return;
    }

    if (password.length < 6) {
      setError(t("login.msg_password_corta"));
      return;
    }

    if (password !== confirmarPassword) {
      setError(t("login.msg_passwords_no_coinciden"));
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

    setMensaje(t("login.msg_cuenta_creada"));
    setCargando(false);
  }

  function traducirError(msg: string): string {
    if (msg.includes("Invalid login credentials")) {
      return t("login.error_credenciales");
    }
    if (msg.includes("already registered")) {
      return t("login.error_ya_registrado");
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
            {t("login.brand_desc")}
          </p>

          <ul className="login-brand-list">
            <li><Package size={15} /> {t("login.brand_item1")}</li>
            <li><BarChart3 size={15} /> {t("login.brand_item2")}</li>
            <li><Zap size={15} /> {t("login.brand_item3")}</li>
          </ul>
        </div>
      </div>

      {/* PANEL DERECHO: FORMULARIO */}
      <div className="login-form-panel">
        <form
          className="login-card fade-up"
          onSubmit={alEnviar}
        >
          <h1>{modo === "login" ? t("login.titulo_login") : t("login.titulo_registro")}</h1>

          <p>
            {modo === "login"
              ? t("login.subtitulo_login")
              : t("login.subtitulo_registro")}
          </p>

          {error && <div className="login-alert login-alert-error">{error}</div>}
          {mensaje && (
            <div className="login-alert login-alert-success">{mensaje}</div>
          )}

          <label className="login-label">{t("login.label_correo")}</label>
          <input
            type="email"
            placeholder="tucorreo@ejemplo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />

          {modo === "login" && (
            <>
              <label className="login-label">
                {t("login.label_usuario")} <span className="login-label-opcional">{t("login.label_usuario_opcional")}</span>
              </label>
              <input
                type="text"
                placeholder={t("login.placeholder_usuario")}
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
              />
            </>
          )}

          <label className="login-label">{t("login.label_password")}</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {modo === "registro" && (
            <>
              <label className="login-label">{t("login.label_confirmar_password")}</label>
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
              t("login.btn_iniciar_sesion")
            ) : (
              t("login.btn_registrarse")
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
              ? t("login.btn_ir_registro")
              : t("login.btn_ir_login")}
          </button>
        </form>
      </div>
    </main>
  );
}
