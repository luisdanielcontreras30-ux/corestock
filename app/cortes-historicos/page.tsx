"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import RequierePlus from "../../components/RequierePlus";
import ContadorAnimado from "../../components/ContadorAnimado";
import { MovimientoCaja } from "../caja/types";
import { cargarCierres } from "../caja/acciones";

// Evita que errores de redondeo de punto flotante (ej. 0.1 + 0.2) marquen
// como "no cuadrado" un cierre de caja que en realidad sí cuadra.
function esDiferenciaCero(diferencia: number) {
  return Math.abs(diferencia) < 0.005;
}

export default function CortesHistoricosPage() {
  return (
    <RequierePlus>
      <CortesHistoricosContenido />
    </RequierePlus>
  );
}

function CortesHistoricosContenido() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();

  const [loading, setLoading] = useState(true);
  const [cierres, setCierres] = useState<MovimientoCaja[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  useEffect(() => {
    if (cargandoAuth) return;

    if (!user) {
      router.push("/login");
      return;
    }

    cargarCierres()
      .then(setCierres)
      .catch((error) => console.error(error))
      .finally(() => setLoading(false));
  }, [cargandoAuth, user]);

  const filtrados = cierres.filter((c) => {
    const fecha = new Date(c.fecha);
    if (desde && fecha < new Date(desde)) return false;
    if (hasta && fecha > new Date(`${hasta}T23:59:59`)) return false;
    return true;
  });

  const totalCortes = filtrados.length;
  const diferenciaAcumulada = filtrados.reduce((sum, c) => sum + (c.diferencia ?? 0), 0);
  const cuadrados = filtrados.filter((c) => esDiferenciaCero(c.diferencia ?? 0)).length;

  if (cargandoAuth || !user || loading) {
    return (
      <main className="fade-up">
        <div className="card">{t("header.cargando")}</div>
      </main>
    );
  }

  return (
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <EncabezadoModulo
        Icono={CalendarClock}
        color="#eab308"
        titulo={t("sidebar.cortes_historicos")}
        subtitulo={t("cortes_historicos.subtitulo")}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 20,
        }}
      >
        <div className="card">
          <p style={{ color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, textTransform: "uppercase", margin: 0 }}>
            {t("cortes_historicos.total_cortes")}
          </p>
          <h2 style={{ fontSize: 30, margin: "10px 0 0 0" }}>
            <ContadorAnimado valor={totalCortes} decimales={0} />
          </h2>
        </div>

        <div className="card">
          <p style={{ color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, textTransform: "uppercase", margin: 0 }}>
            {t("cortes_historicos.cuadrados")}
          </p>
          <h2 style={{ fontSize: 30, margin: "10px 0 0 0", color: "#10b981" }}>
            <ContadorAnimado valor={cuadrados} decimales={0} />
          </h2>
        </div>

        <div className="card">
          <p style={{ color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, textTransform: "uppercase", margin: 0 }}>
            {t("cortes_historicos.diferencia_acumulada")}
          </p>
          <h2
            style={{
              fontSize: 30,
              margin: "10px 0 0 0",
              color: esDiferenciaCero(diferenciaAcumulada) ? "var(--text-primary)" : "#ef4444",
            }}
          >
            $<ContadorAnimado valor={diferenciaAcumulada} decimales={2} />
          </h2>
        </div>
      </div>

      <div className="card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("promociones.fecha_inicio")}</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("promociones.fecha_fin")}</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>{t("tabla.fecha")}</th>
              <th>{t("caja.monto_contado")}</th>
              <th>{t("cortes_historicos.col_esperado")}</th>
              <th>{t("caja.diferencia")}</th>
              <th>{t("ajustes_stock.col_motivo")}</th>
            </tr>
          </thead>

          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  {t("cortes_historicos.sin_cortes")}
                </td>
              </tr>
            ) : (
              filtrados.map((c) => (
                <tr key={c.id}>
                  <td>{new Date(c.fecha).toLocaleString()}</td>
                  <td style={{ fontWeight: 700 }}>${Number(c.monto).toFixed(2)}</td>
                  <td>${Number(c.monto_esperado ?? 0).toFixed(2)}</td>
                  <td>
                    <span style={{ color: esDiferenciaCero(c.diferencia ?? 0) ? "#10b981" : "#ef4444", fontWeight: 700 }}>
                      ${Number(c.diferencia ?? 0).toFixed(2)}
                    </span>
                  </td>
                  <td>{c.motivo || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
