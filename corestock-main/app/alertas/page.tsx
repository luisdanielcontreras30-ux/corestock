"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Package, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useIdioma } from "../../components/LanguageProvider";
import { useAuth } from "../../components/AuthProvider";

interface ProductoAlerta {
  id: number;
  nombre: string;
  categoria: string;
  stock: number;
  imagen: string | null;
}

export default function Alertas() {
  const { t } = useIdioma();
  const { user, cargando: cargandoAuth } = useAuth();
  const [alertas, setAlertas] = useState<ProductoAlerta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (cargandoAuth) return;

    if (!user) {
      window.location.href = "/login";
      return;
    }

    cargar(user.id);
  }, [cargandoAuth, user]);

  async function cargar(userId: string) {
    setLoading(true);

    const { data } = await supabase
      .from("productos")
      .select("*")
      .eq("user_id", userId)
      .lte("stock", 5)
      .order("stock");

    if (data) {
      setAlertas(data as ProductoAlerta[]);
    }

    setLoading(false);
  }

  const agotados = alertas.filter((p) => p.stock === 0).length;
  const stockBajo = alertas.length - agotados;

  if (loading) {
    return (
      <main className="fade-up">
        <div className="card">{t("alertas.cargando")}</div>
      </main>
    );
  }

  return (
    <main
      className="fade-up"
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      <div>
        <h1 style={{ fontSize: 34, fontWeight: 700 }}>{t("alertas.titulo")}</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          {t("alertas.subtitulo")}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 20,
        }}
      >
        <div className="card">
          <p style={{ color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, textTransform: "uppercase", margin: 0 }}>
            {t("alertas.total_alertas")}
          </p>
          <h2 style={{ fontSize: 30, margin: "10px 0 0 0" }}>{alertas.length}</h2>
        </div>

        <div className="card">
          <p style={{ color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, textTransform: "uppercase", margin: 0 }}>
            {t("alertas.stock_bajo")}
          </p>
          <h2 style={{ fontSize: 30, margin: "10px 0 0 0", color: "#f59e0b" }}>{stockBajo}</h2>
        </div>

        <div className="card">
          <p style={{ color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, textTransform: "uppercase", margin: 0 }}>
            {t("alertas.agotados")}
          </p>
          <h2 style={{ fontSize: 30, margin: "10px 0 0 0", color: "#ef4444" }}>{agotados}</h2>
        </div>
      </div>

      {alertas.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "50px 20px" }}>
          <h3 style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <CheckCircle2 size={20} color="#10b981" /> {t("alertas.todo_bien")}
          </h3>
          <p style={{ color: "var(--text-secondary)" }}>
            {t("alertas.sin_stock_bajo")}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
          }}
        >
          {alertas.map((producto) => (
            <div key={producto.id} className="card">
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                {producto.imagen ? (
                  <img
                    src={producto.imagen}
                    alt={producto.nombre}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 10,
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 10,
                      background: "var(--glass-bg)",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Package size={22} color="var(--text-muted)" />
                  </div>
                )}

                <div style={{ minWidth: 0 }}>
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {producto.nombre}
                  </h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: 12.5, margin: "2px 0 0 0" }}>
                    {producto.categoria || t("alertas.sin_categoria")}
                  </p>
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                  {t("alertas.stock")}: <strong style={{ color: "var(--text-primary)" }}>{producto.stock}</strong>
                </span>

                {producto.stock === 0 ? (
                  <span
                    style={{
                      background: "rgba(239, 68, 68, 0.12)",
                      color: "#ef4444",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <XCircle size={13} /> {t("alertas.agotado")}
                  </span>
                ) : (
                  <span
                    style={{
                      background: "rgba(245, 158, 11, 0.12)",
                      color: "#f59e0b",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <AlertTriangle size={13} /> {t("alertas.stock_bajo")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
