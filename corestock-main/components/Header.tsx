"use client";

import React, { useEffect, useRef, useState } from "react";
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
  const notisRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function alHacerClicFuera(e: MouseEvent) {
      if (
        notisRef.current &&
        !notisRef.current.contains(e.target as Node)
      ) {
        setNotisAbiertas(false);
      }
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () =>
      document.removeEventListener("mousedown", alHacerClicFuera);
  }, []);

  const inicial = correo ? correo.charAt(0).toUpperCase() : "U";
  const agotados = alertas.filter((a) => a.stock === 0).length;

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
      <div className="user-menu" ref={notisRef}>
        <button
          className="bell-btn"
          onClick={() => {
            setNotisAbiertas((v) => !v);
            cargarAlertas();
          }}
          aria-label={t("header.notificaciones")}
        >
          <Bell size={17} />
          {alertas.length > 0 && (
            <span className="bell-badge">{alertas.length}</span>
          )}
        </button>

        {notisAbiertas && (
          <div className="user-dropdown fade-up notis-dropdown">
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
                        background:
                          p.stock === 0 ? "#ef4444" : "#f59e0b",
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
        )}
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
