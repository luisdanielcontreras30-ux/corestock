"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function Header({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void;
}) {
  const [correo, setCorreo] = useState("");
  const [abierto, setAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCorreo(data.user.email || "");
    });
  }, []);

  useEffect(() => {
    function alHacerClicFuera(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () =>
      document.removeEventListener("mousedown", alHacerClicFuera);
  }, []);

  async function cerrarSesion() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const inicial = correo ? correo.charAt(0).toUpperCase() : "U";

  return (
    <header className="topbar fade-up">
      <button
        className="hamburger-btn"
        onClick={onToggleSidebar}
        aria-label="Abrir menú"
      >
        <span />
        <span />
        <span />
      </button>

      <div className="topbar-spacer" />

      <div className="user-menu" ref={menuRef}>
        <button
          className="user-avatar-btn"
          onClick={() => setAbierto((v) => !v)}
        >
          <span className="user-avatar">{inicial}</span>
          <span className="user-email-preview" title={correo}>
            {correo || "Cargando..."}
          </span>
          <span className={`chevron ${abierto ? "chevron-up" : ""}`}>▾</span>
        </button>

        {abierto && (
          <div className="user-dropdown fade-up">
            <div className="user-dropdown-header">
              <span className="user-avatar user-avatar-lg">{inicial}</span>
              <div>
                <p className="user-dropdown-name">Mi cuenta</p>
                <p className="user-dropdown-email">{correo}</p>
              </div>
            </div>

            <Link
              href="/cuenta"
              className="user-dropdown-item"
              onClick={() => setAbierto(false)}
            >
              👤 Ver cuenta
            </Link>

            <button
              className="user-dropdown-item user-dropdown-danger"
              onClick={cerrarSesion}
            >
              🚪 Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
