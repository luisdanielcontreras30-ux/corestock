"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { Bell, CheckCircle2 } from "lucide-react";
import { useIdioma } from "./LanguageProvider";
import { useAuth } from "./AuthProvider";

interface ProductoAlerta {
  id: number;
  nombre: string;
  stock: number;
}

export default function Header({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void;
}) {
  const { t } = useIdioma();
  const { user } = useAuth();
  const correo = user?.email ?? "";

  const [notisAbiertas, setNotisAbiertas] = useState(false);
  const [alertas, setAlertas] = useState<ProductoAlerta[]>([]);
  const [posicion, setPosicion] = useState({ top: 0, right: 0 });
  const [montado, setMontado] = useState(false);

  const notisRef = useRef<HTMLDivElement>(null);
  const bellBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (user) cargarAlertas();
  }, [user]);

  async function cargarAlertas() {
    if (!user) return;

    const { data } = await supabase
      .from("productos")
      .select("id, nombre, stock")
      .eq("user_id", user.id)
      .lte("stock", 5)
      .order("stock");

    if (data) setAlertas(data as ProductoAlerta[]);
  }

  function alAbrirNotis() {
    if (bellBtnRef.current) {
      const rect = bellBtnRef.current.getBoundingClientRect();
      setPosicion({
        top: rect.bottom + 10,
        right: window.innerWidth - rect.right,
      });
    }
    setNotisAbiertas((v) => !v);
    cargarAlertas();
  }

  useEffect(() => {
    function alHacerClicFuera(e: MouseEvent) {
      const clicEnBoton = bellBtnRef.current?.contains(e.target as Node);
      const clicEnDropdown = notisRef.current?.contains(e.target as Node);

      if (!clicEnBoton && !clicEnDropdown) {
        setNotisAbiertas(false);
      }
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () =>
      document.removeEventListener("mousedown", alHacerClicFuera);
  }, []);

  const inicial = correo ? correo.charAt(0).toUpperCase() : "U";
  const agotados = alertas.filter((a) => a.stock === 0).length;

  const dropdownNotis = notisAbiertas && (
    <div
      ref={notisRef}
      className="user-dropdown fade-up notis-dropdown notis-dropdown-portal"
      style={{
        position: "fixed",
        top: posicion.top,
        right: posicion.right,
      }}
    >
      <div className="notis-header">
        <p className="user-dropdown-name">{t("header.notificaciones")}</p>
        {agotados > 0 && (
          <span className="notis-agotados-pill">
            {agotados} {t("header.agotados")}
          </span>
        )}
      </div>

      {alertas.length === 0 ? (
        <p className="notis-vacio">
          <CheckCircle2 size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          {t("header.sin_alertas")}
        </p>
      ) : (
        <div className="notis-lista">
          {alertas.slice(0, 6).map((p) => (
            <div key={p.id} className="notis-item">
              <span
                className="notis-dot"
                style={{
                  background: p.stock === 0 ? "#ef4444" : "#f59e0b",
                }}
              />
              <span className="notis-nombre">{p.nombre}</span>
              <span className="notis-stock">
                {p.stock === 0 ? "0" : `${p.stock} uds.`}
              </span>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/alertas"
        className="user-dropdown-item"
        onClick={() => setNotisAbiertas(false)}
        style={{ textAlign: "center", justifyContent: "center" }}
      >
        {t("header.ver_todas_alertas")}
      </Link>
    </div>
  );

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

      {/* NOTIFICACIONES */}
      <div className="user-menu">
        <button
          ref={bellBtnRef}
          className="bell-btn"
          onClick={alAbrirNotis}
          aria-label={t("header.notificaciones")}
        >
          <Bell size={17} />
          {alertas.length > 0 && (
            <span className="bell-badge">{alertas.length}</span>
          )}
        </button>

        {montado && createPortal(dropdownNotis, document.body)}
      </div>

      {/* CUENTA: solo muestra correo, sin interacción */}
      <div className="user-static">
        <span className="user-avatar">{inicial}</span>
        <span className="user-email-preview" title={correo}>
          {correo || t("header.cargando")}
        </span>
      </div>
    </header>
  );
}
