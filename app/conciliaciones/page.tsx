"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Trash2 } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { MovimientoConciliacion, TipoMovimientoConciliacion } from "./types";
import { cargarMovimientos, crearMovimiento, alternarConciliado, eliminarMovimiento } from "./acciones";

export default function ConciliacionesPage() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();

  const [loading, setLoading] = useState(true);
  const [movimientos, setMovimientos] = useState<MovimientoConciliacion[]>([]);

  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<TipoMovimientoConciliacion>("abono");
  const [monto, setMonto] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function obtenerDatos() {
    setLoading(true);
    try {
      const datos = await cargarMovimientos();
      setMovimientos(datos);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (cargandoAuth) return;

    if (!user) {
      router.push("/login");
      return;
    }

    obtenerDatos();
  }, [cargandoAuth, user]);

  const resumen = useMemo(() => {
    let totalAbonos = 0;
    let totalCargos = 0;
    let pendiente = 0;

    for (const m of movimientos) {
      if (m.tipo === "abono") totalAbonos += Number(m.monto);
      else totalCargos += Number(m.monto);

      if (!m.conciliado) pendiente += 1;
    }

    return { totalAbonos, totalCargos, pendiente };
  }, [movimientos]);

  async function guardar() {
    if (guardando) return;

    if (!descripcion.trim()) {
      alert(t("conciliaciones.msg_falta_descripcion"));
      return;
    }

    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      alert(t("conciliaciones.msg_monto_invalido"));
      return;
    }

    try {
      setGuardando(true);
      await crearMovimiento(descripcion, tipo, montoNum);
      setDescripcion("");
      setMonto("");
      setTipo("abono");
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(t("conciliaciones.msg_error_guardar"));
    } finally {
      setGuardando(false);
    }
  }

  async function alternar(mov: MovimientoConciliacion) {
    try {
      await alternarConciliado(mov.id, !mov.conciliado);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(t("conciliaciones.msg_error_estado"));
    }
  }

  async function borrar(id: number) {
    if (!confirm(t("conciliaciones.confirmar_eliminar"))) return;

    try {
      await eliminarMovimiento(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(t("conciliaciones.msg_error_eliminar"));
    }
  }

  if (cargandoAuth || !user || loading) {
    return (
      <main className="fade-up">
        <div className="card">{t("header.cargando")}</div>
      </main>
    );
  }

  return (
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 34, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
          <Landmark size={28} /> {t("sidebar.conciliaciones")}
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>{t("conciliaciones.subtitulo")}</p>
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
            {t("conciliaciones.total_abonos")}
          </p>
          <h2 style={{ fontSize: 30, margin: "10px 0 0 0", color: "#10b981" }}>
            ${resumen.totalAbonos.toFixed(2)}
          </h2>
        </div>
        <div className="card">
          <p style={{ color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, textTransform: "uppercase", margin: 0 }}>
            {t("conciliaciones.total_cargos")}
          </p>
          <h2 style={{ fontSize: 30, margin: "10px 0 0 0", color: "#ef4444" }}>
            ${resumen.totalCargos.toFixed(2)}
          </h2>
        </div>
        <div className="card">
          <p style={{ color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, textTransform: "uppercase", margin: 0 }}>
            {t("conciliaciones.pendientes")}
          </p>
          <h2 style={{ fontSize: 30, margin: "10px 0 0 0" }}>{resumen.pendiente}</h2>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{t("conciliaciones.registrar")}</h2>

        <div className="productos-grid">
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={t("conciliaciones.descripcion_placeholder")}
          />

          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimientoConciliacion)}>
            <option value="abono">{t("conciliaciones.tipo_abono")}</option>
            <option value="cargo">{t("conciliaciones.tipo_cargo")}</option>
          </select>

          <input
            type="number"
            min="0.01"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder={t("caja.monto")}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? t("compras.guardando") : t("conciliaciones.registrar")}
          </button>
        </div>
      </div>

      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>{t("tabla.fecha")}</th>
              <th>{t("conciliaciones.col_descripcion")}</th>
              <th>{t("caja.col_tipo")}</th>
              <th>{t("tabla.total")}</th>
              <th>{t("usuarios.col_estado")}</th>
              <th>{t("productos.col_acciones")}</th>
            </tr>
          </thead>

          <tbody>
            {movimientos.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  {t("conciliaciones.sin_movimientos")}
                </td>
              </tr>
            ) : (
              movimientos.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.fecha).toLocaleString()}</td>
                  <td>{m.descripcion}</td>
                  <td>
                    <span
                      style={{
                        background: m.tipo === "abono" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                        color: m.tipo === "abono" ? "#10b981" : "#ef4444",
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 700,
                      }}
                    >
                      {t(m.tipo === "abono" ? "conciliaciones.tipo_abono" : "conciliaciones.tipo_cargo")}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>${Number(m.monto).toFixed(2)}</td>
                  <td>
                    <button
                      onClick={() => alternar(m)}
                      style={{
                        background: m.conciliado ? "rgba(16,185,129,0.12)" : "rgba(148,163,184,0.15)",
                        color: m.conciliado ? "#10b981" : "var(--text-secondary)",
                        border: "none",
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {m.conciliado ? t("conciliaciones.conciliado") : t("conciliaciones.pendiente")}
                    </button>
                  </td>
                  <td>
                    <button
                      className="btn-delete"
                      aria-label={t("productos.eliminar")}
                      onClick={() => borrar(m.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
