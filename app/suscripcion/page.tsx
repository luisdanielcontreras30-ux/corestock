"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Crown, Check, ExternalLink } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useSuscripcion } from "../../components/SuscripcionProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import { iniciarCheckoutPlus, abrirPortalFacturacion } from "../../lib/suscripcionAcciones";
import { BLOQUEO_PLUS_ACTIVO } from "../../lib/suscripcion";

const CARACTERISTICAS_FREE = [
  "sidebar.ventas",
  "sidebar.productos",
  "sidebar.graficas",
  "sidebar.caja",
  "sidebar.catalogo_linea",
  "sidebar.ajustes_stock",
  "sidebar.alertas",
  "sidebar.clientes",
];

const CARACTERISTICAS_PLUS = [
  "sidebar.compras",
  "sidebar.proveedores",
  "sidebar.cotizaciones",
  "sidebar.facturas",
  "sidebar.facturas_globales",
  "sidebar.fabricacion",
  "sidebar.traspasos",
  "sidebar.conciliaciones",
  "sidebar.cortes_historicos",
  "sidebar.portal_clientes",
  "sidebar.asistente",
  "sidebar.promociones",
];

export default function SuscripcionPage() {
  return (
    <Suspense fallback={null}>
      <SuscripcionInterna />
    </Suspense>
  );
}

function SuscripcionInterna() {
  const { cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();
  const { plan, esPlus, cargando, refrescar } = useSuscripcion();
  const searchParams = useSearchParams();

  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const estado = searchParams.get("estado");
    if (estado === "exito") {
      refrescar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function alActualizarAPlus() {
    if (procesando) return;
    setError("");
    setProcesando(true);

    try {
      const url = await iniciarCheckoutPlus();
      window.location.href = url;
    } catch (err) {
      console.error(err);
      const detalle = err instanceof Error ? err.message : "";
      setError(detalle || t("plus.msg_error_checkout"));
      setProcesando(false);
    }
  }

  async function alGestionarSuscripcion() {
    if (procesando) return;
    setError("");
    setProcesando(true);

    try {
      const url = await abrirPortalFacturacion();
      window.location.href = url;
    } catch (err) {
      console.error(err);
      const detalle = err instanceof Error ? err.message : "";
      setError(detalle || t("plus.msg_error_portal"));
      setProcesando(false);
    }
  }

  if (cargandoAuth || cargando) {
    return (
      <main className="fade-up">
        <div className="card">{t("header.cargando")}</div>
      </main>
    );
  }

  return (
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <EncabezadoModulo
        Icono={Crown}
        color="#f59e0b"
        titulo={t("plus.titulo_pagina")}
        subtitulo={t("plus.subtitulo_pagina")}
      />

      {searchParams.get("estado") === "cancelado" && (
        <div className="card" style={{ borderColor: "#f59e0b" }}>
          <p style={{ margin: 0, fontSize: 13.5 }}>{t("plus.msg_cancelado")}</p>
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: "#ef4444" }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "#ef4444" }}>{error}</p>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}
      >
        {/* PLAN GRATUITO */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>{t("plus.plan_free_nombre")}</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              {t("plus.plan_free_desc")}
            </p>
          </div>

          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {CARACTERISTICAS_FREE.map((clave) => (
              <li key={clave} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                <Check size={15} color="#10b981" /> {t(clave)}
              </li>
            ))}
          </ul>

          {plan === "free" && (
            <span
              style={{
                marginTop: "auto",
                textAlign: "center",
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--text-secondary)",
              }}
            >
              {t("plus.plan_actual")}
            </span>
          )}
        </div>

        {/* PLAN PLUS+ */}
        <div
          className="card"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            border: "2px solid #f59e0b",
            position: "relative",
          }}
        >
          <div>
            <h2 style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <Crown size={19} color="#f59e0b" /> {t("plus.plan_plus_nombre")}
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              {t("plus.plan_plus_desc")}
            </p>
          </div>

          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {CARACTERISTICAS_PLUS.map((clave) => (
              <li key={clave} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                <Check size={15} color="#f59e0b" /> {t(clave)}
              </li>
            ))}
          </ul>

          {esPlus ? (
            <button
              className="btn-primary"
              style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              onClick={alGestionarSuscripcion}
              disabled={procesando}
            >
              <ExternalLink size={15} />
              {procesando ? t("plus.procesando") : t("plus.boton_gestionar")}
            </button>
          ) : BLOQUEO_PLUS_ACTIVO ? (
            <button
              className="btn-primary"
              style={{ marginTop: "auto" }}
              onClick={alActualizarAPlus}
              disabled={procesando}
            >
              {procesando ? t("plus.procesando") : t("plus.boton_actualizar")}
            </button>
          ) : (
            <span
              style={{
                marginTop: "auto",
                textAlign: "center",
                fontSize: 12.5,
                fontWeight: 700,
                color: "#f59e0b",
              }}
            >
              {t("plus.prueba_gratis_activa")}
            </span>
          )}
        </div>
      </div>
    </main>
  );
}
