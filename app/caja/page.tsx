"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, ArrowDownCircle, ArrowUpCircle, Lock, Unlock } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import ContadorAnimado from "../../components/ContadorAnimado";
import { MovimientoCaja } from "./types";
import { cargarMovimientos, registrarMovimiento } from "./acciones";

// Evita que errores de redondeo de punto flotante (ej. 0.1 + 0.2) marquen
// como "no cuadrado" un cierre de caja que en realidad sí cuadra.
function esDiferenciaCero(diferencia: number) {
  return Math.abs(diferencia) < 0.005;
}

function calcularEstado(movimientos: MovimientoCaja[]) {
  let abierta = false;
  let saldo = 0;

  for (const m of movimientos) {
    if (m.tipo === "apertura") {
      abierta = true;
      saldo = m.monto;
    } else if (m.tipo === "entrada") {
      saldo += m.monto;
    } else if (m.tipo === "salida") {
      saldo -= m.monto;
    } else if (m.tipo === "cierre") {
      abierta = false;
    }
  }

  return { abierta, saldo };
}

const ETIQUETA_TIPO: Record<string, string> = {
  apertura: "caja.tipo_apertura",
  entrada: "caja.tipo_entrada",
  salida: "caja.tipo_salida",
  cierre: "caja.tipo_cierre",
};

const COLOR_TIPO: Record<string, string> = {
  apertura: "#3b82f6",
  entrada: "#10b981",
  salida: "#ef4444",
  cierre: "#f59e0b",
};

export default function CajaPage() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();

  const [loading, setLoading] = useState(true);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [procesando, setProcesando] = useState(false);

  const [montoApertura, setMontoApertura] = useState("");
  const [montoMovimiento, setMontoMovimiento] = useState("");
  const [motivoMovimiento, setMotivoMovimiento] = useState("");
  const [montoContado, setMontoContado] = useState("");
  const [notaCierre, setNotaCierre] = useState("");

  async function obtenerDatos() {
    setLoading(true);
    try {
      const datos = await cargarMovimientos();
      setMovimientos(datos);
    } catch (error) {
      console.error(error);
      alert(t("comun.msg_error_cargar_datos"));
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

  const { abierta, saldo } = useMemo(() => calcularEstado(movimientos), [movimientos]);
  const historialReciente = [...movimientos].reverse();

  async function abrirCaja() {
    if (procesando) return;

    const monto = Number(montoApertura);
    if (!Number.isFinite(monto) || monto < 0) {
      alert(t("caja.msg_monto_invalido"));
      return;
    }

    try {
      setProcesando(true);
      await registrarMovimiento("apertura", monto, t("caja.tipo_apertura"));
      setMontoApertura("");
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(t("caja.msg_error_movimiento"));
    } finally {
      setProcesando(false);
    }
  }

  async function registrarEntradaSalida(tipo: "entrada" | "salida") {
    if (procesando) return;

    const monto = Number(montoMovimiento);
    if (!Number.isFinite(monto) || monto <= 0) {
      alert(t("caja.msg_monto_invalido"));
      return;
    }

    if (tipo === "salida" && monto > saldo) {
      alert(t("caja.msg_sin_saldo"));
      return;
    }

    try {
      setProcesando(true);
      await registrarMovimiento(tipo, monto, motivoMovimiento);
      setMontoMovimiento("");
      setMotivoMovimiento("");
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(t("caja.msg_error_movimiento"));
    } finally {
      setProcesando(false);
    }
  }

  async function cerrarCaja() {
    if (procesando) return;

    const contado = Number(montoContado);
    if (!Number.isFinite(contado) || contado < 0) {
      alert(t("caja.msg_monto_invalido"));
      return;
    }

    const diferencia = contado - saldo;

    try {
      setProcesando(true);
      await registrarMovimiento("cierre", contado, notaCierre, {
        montoEsperado: saldo,
        diferencia,
      });
      setMontoContado("");
      setNotaCierre("");
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(t("caja.msg_error_movimiento"));
    } finally {
      setProcesando(false);
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
      <EncabezadoModulo
        Icono={Inbox}
        color="#84cc16"
        titulo={t("sidebar.caja")}
        subtitulo={t("caja.subtitulo")}
      />

      {!abierta ? (
        <div className="card">
          <h2 style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <Unlock size={18} /> {t("caja.abrir_caja")}
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
            {t("caja.abrir_caja_desc")}
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={montoApertura}
              onChange={(e) => setMontoApertura(e.target.value)}
              placeholder={t("caja.monto_inicial")}
              style={{ maxWidth: 220 }}
            />
            <button className="btn-primary" onClick={abrirCaja} disabled={procesando}>
              {t("caja.abrir_caja")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="card"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}
          >
            <div>
              <p style={{ color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, textTransform: "uppercase", margin: 0 }}>
                {t("caja.saldo_actual")}
              </p>
              <h2 style={{ fontSize: 30, margin: "6px 0 0 0" }}>$<ContadorAnimado valor={saldo} decimales={2} /></h2>
            </div>
            <span
              style={{
                background: "rgba(16,185,129,0.12)",
                color: "#10b981",
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {t("caja.caja_abierta")}
            </span>
          </div>

          <div className="dashboard-2fr-1fr">
            <div className="card">
              <h2 style={{ marginBottom: 16 }}>{t("caja.registrar_movimiento")}</h2>

              <div className="productos-grid">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={montoMovimiento}
                  onChange={(e) => setMontoMovimiento(e.target.value)}
                  placeholder={t("caja.monto")}
                />
                <input
                  value={motivoMovimiento}
                  onChange={(e) => setMotivoMovimiento(e.target.value)}
                  placeholder={t("caja.motivo_placeholder")}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                <button
                  className="btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#10b981" }}
                  onClick={() => registrarEntradaSalida("entrada")}
                  disabled={procesando}
                >
                  <ArrowDownCircle size={15} /> {t("caja.tipo_entrada")}
                </button>
                <button
                  className="btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#ef4444" }}
                  onClick={() => registrarEntradaSalida("salida")}
                  disabled={procesando}
                >
                  <ArrowUpCircle size={15} /> {t("caja.tipo_salida")}
                </button>
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <Lock size={18} /> {t("caja.cerrar_caja")}
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
                {t("caja.cerrar_caja_desc")}
              </p>

              <input
                type="number"
                min="0"
                step="0.01"
                value={montoContado}
                onChange={(e) => setMontoContado(e.target.value)}
                placeholder={t("caja.monto_contado")}
              />

              <input
                style={{ marginTop: 10 }}
                value={notaCierre}
                onChange={(e) => setNotaCierre(e.target.value)}
                placeholder={t("compras.nota_placeholder")}
              />

              {montoContado && Number.isFinite(Number(montoContado)) && (
                <p style={{ fontSize: 12.5, marginTop: 10, color: "var(--text-secondary)" }}>
                  {t("caja.diferencia")}:{" "}
                  <strong style={{ color: esDiferenciaCero(Number(montoContado) - saldo) ? "#10b981" : "#ef4444" }}>
                    ${(Number(montoContado) - saldo).toFixed(2)}
                  </strong>
                </p>
              )}

              <button
                className="btn-delete"
                style={{ marginTop: 12, width: "100%" }}
                onClick={cerrarCaja}
                disabled={procesando}
              >
                {t("caja.cerrar_caja")}
              </button>
            </div>
          </div>
        </>
      )}

      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>{t("tabla.fecha")}</th>
              <th>{t("caja.col_tipo")}</th>
              <th>{t("tabla.total")}</th>
              <th>{t("ajustes_stock.col_motivo")}</th>
              <th>{t("caja.col_diferencia")}</th>
            </tr>
          </thead>

          <tbody>
            {historialReciente.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  {t("caja.sin_movimientos")}
                </td>
              </tr>
            ) : (
              historialReciente.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.fecha).toLocaleString()}</td>
                  <td>
                    <span
                      style={{
                        background: `${COLOR_TIPO[m.tipo]}1a`,
                        color: COLOR_TIPO[m.tipo],
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 700,
                      }}
                    >
                      {t(ETIQUETA_TIPO[m.tipo])}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>${Number(m.monto).toFixed(2)}</td>
                  <td>{m.motivo || "—"}</td>
                  <td>
                    {m.diferencia != null ? (
                      <span style={{ color: esDiferenciaCero(m.diferencia) ? "#10b981" : "#ef4444", fontWeight: 700 }}>
                        ${Number(m.diferencia).toFixed(2)}
                      </span>
                    ) : (
                      "—"
                    )}
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
