"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";

// Página a la que llega el enlace del correo de "recuperar
// contraseña" (ver login.link_olvidaste_password en app/login). El
// enlace trae una sesión temporal de recuperación en la URL —
// supabase-js la detecta sola y AuthProvider expone ese usuario aquí,
// exactamente igual que una sesión normal. Sin esa sesión (enlace
// vencido, ya usado, o alguien entrando directo a esta URL) no hay
// nada que restablecer.
export default function RestablecerContrasena() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();

  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError(t("login.msg_password_corta"));
      return;
    }

    if (password !== confirmar) {
      setError(t("login.msg_passwords_no_coinciden"));
      return;
    }

    setGuardando(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error(error);
      setError(t("restablecer.msg_error"));
      setGuardando(false);
      return;
    }

    setListo(true);
    setGuardando(false);
  }

  if (cargandoAuth) {
    return (
      <main className="login-page">
        <div className="login-form-panel">
          <div className="login-card fade-up">{t("header.cargando")}</div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="login-page">
        <div className="login-form-panel">
          <div className="login-card fade-up">
            <h1>{t("restablecer.titulo")}</h1>
            <p>{t("restablecer.msg_enlace_invalido")}</p>
            <button className="btn-login" onClick={() => router.push("/login")}>
              {t("login.btn_ir_login")}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (listo) {
    return (
      <main className="login-page">
        <div className="login-form-panel">
          <div className="login-card fade-up">
            <h1>{t("restablecer.titulo")}</h1>
            <div className="login-alert login-alert-success">{t("restablecer.msg_exito")}</div>
            <button className="btn-login" onClick={() => router.push("/menu")}>
              {t("restablecer.btn_ir_app")}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="login-page">
      <div className="login-form-panel">
        <form className="login-card fade-up" onSubmit={alEnviar}>
          <h1>{t("restablecer.titulo")}</h1>
          <p>{t("restablecer.subtitulo")}</p>

          {error && <div className="login-alert login-alert-error">{error}</div>}

          <label className="login-label" htmlFor="restablecer-password">
            {t("login.label_password")}
          </label>
          <input
            id="restablecer-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <label className="login-label" htmlFor="restablecer-confirmar">
            {t("login.label_confirmar_password")}
          </label>
          <input
            id="restablecer-confirmar"
            type="password"
            placeholder="••••••••"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
          />

          <button className="btn-login" disabled={guardando} type="submit">
            {guardando ? <span className="login-spinner" /> : t("restablecer.btn_guardar")}
          </button>
        </form>
      </div>
    </main>
  );
}
