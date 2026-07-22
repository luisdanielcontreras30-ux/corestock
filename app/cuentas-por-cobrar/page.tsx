"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, Check } from "lucide-react";
import { mensajeErrorSeguro } from "../../lib/errores";
import { useAuth } from "../../components/AuthProvider";
import { useMiembroActivo } from "../../components/MiembroActivoProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import { VentaFiada, DeudaCliente } from "./types";
import { cargarPendientes, marcarComoCobrado } from "./acciones";
import { formatoMoneda } from "../ventas/utils";

export default function CuentasPorCobrarPage() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { puede } = useMiembroActivo();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();
  // Marcar cobrado hace un update sobre "ventas", que RLS exige el
  // permiso "editar_ventas" para tocar (ver
  // supabase_permisos_miembros.sql) — sin este candado, un miembro sin
  // ese permiso veía el botón activo, RLS bloqueaba el update en
  // silencio (sin lanzar error), y la venta reaparecía como pendiente
  // al recargar sin ninguna explicación.
  const puedeCobrar = puede("editar_ventas");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [ventas, setVentas] = useState<VentaFiada[]>([]);
  const [cobrando, setCobrando] = useState<number | null>(null);

  async function obtenerDatos() {
    setLoading(true);
    setError(false);
    try {
      const datos = await cargarPendientes();
      setVentas(datos);
    } catch (error) {
      console.error(error);
      setError(true);
      mostrarToast(t("comun.msg_error_cargar_datos"), "error");
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

  const deudas: DeudaCliente[] = useMemo(() => {
    const porCliente = new Map<string, DeudaCliente>();

    for (const venta of ventas) {
      const clave = venta.cliente_id != null ? String(venta.cliente_id) : `sin-cliente-${venta.id}`;
      const nombre = venta.clientes?.nombre ?? t("ventas.cliente_general");

      const actual = porCliente.get(clave) ?? {
        clienteId: venta.cliente_id,
        nombre,
        totalPendiente: 0,
        ventas: [],
      };

      actual.totalPendiente += venta.total;
      actual.ventas.push(venta);
      porCliente.set(clave, actual);
    }

    return Array.from(porCliente.values()).sort((a, b) => b.totalPendiente - a.totalPendiente);
  }, [ventas, t]);

  const totalPendiente = useMemo(() => ventas.reduce((acc, v) => acc + v.total, 0), [ventas]);

  async function cobrar(venta: VentaFiada) {
    if (cobrando !== null || !puedeCobrar) return;

    if (
      !(await confirmar(
        t("cuentas_por_cobrar.confirmar_cobro").replace("{monto}", formatoMoneda(venta.total))
      ))
    )
      return;

    try {
      setCobrando(venta.id);
      await marcarComoCobrado(venta.id);
      await obtenerDatos();
      mostrarToast(t("cuentas_por_cobrar.msg_cobrado"), "exito");
    } catch (error) {
      console.error(error);
      const detalle =
        error instanceof Error && error.message === "NO_ACTUALIZADO"
          ? t("permisos.sin_acceso_accion")
          : mensajeErrorSeguro(error);
      mostrarToast(detalle || t("cuentas_por_cobrar.msg_error"), "error");
    } finally {
      setCobrando(null);
    }
  }

  if (cargandoAuth || !user) {
    return (
      <main className="fade-up">
        <div className="card">{t("header.cargando")}</div>
      </main>
    );
  }

  return (
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <EncabezadoModulo
        Icono={HandCoins}
        color="#eab308"
        titulo={t("sidebar.cuentas_por_cobrar")}
        subtitulo={t("cuentas_por_cobrar.subtitulo")}
      />

      {loading ? (
        <div className="card">{t("header.cargando")}</div>
      ) : error ? (
        <div className="card" style={{ textAlign: "center", padding: "50px 20px" }}>
          <p style={{ color: "#ef4444", marginBottom: 14 }}>{t("comun.msg_error_cargar_datos")}</p>
          <button className="btn-primary" onClick={obtenerDatos}>
            {t("empresa.reintentar")}
          </button>
        </div>
      ) : (
      <>
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "rgba(234, 179, 8, 0.15)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <HandCoins size={24} color="#eab308" />
        </span>
        <div>
          <p style={{ color: "var(--text-secondary)", fontSize: 12.5, margin: 0, textTransform: "uppercase", fontWeight: 600 }}>
            {t("cuentas_por_cobrar.total_pendiente")}
          </p>
          <h2 style={{ margin: "2px 0 0 0", fontSize: 26 }}>{formatoMoneda(totalPendiente)}</h2>
        </div>
      </div>

      {deudas.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "50px 20px", color: "var(--text-secondary)" }}>
          {t("cuentas_por_cobrar.sin_pendientes")}
        </div>
      ) : (
        deudas.map((deuda) => (
          <div key={deuda.clienteId ?? deuda.nombre} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ margin: 0 }}>{deuda.nombre}</h3>
              <span style={{ fontWeight: 700, color: "#eab308" }}>{formatoMoneda(deuda.totalPendiente)}</span>
            </div>

            <div className="tabla">
              <table>
                <thead>
                  <tr>
                    <th>{t("tabla.fecha")}</th>
                    <th>{t("tabla.producto")}</th>
                    <th>{t("tabla.cantidad")}</th>
                    <th>{t("tabla.total")}</th>
                    <th>{t("productos.col_acciones")}</th>
                  </tr>
                </thead>
                <tbody>
                  {deuda.ventas.map((venta) => (
                    <tr key={venta.id}>
                      <td>{new Date(venta.fecha).toLocaleDateString()}</td>
                      <td>{venta.producto}</td>
                      <td>{venta.cantidad}</td>
                      <td>{formatoMoneda(venta.total)}</td>
                      <td>
                        {puedeCobrar ? (
                          <button
                            className="btn-success"
                            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                            disabled={cobrando === venta.id}
                            onClick={() => cobrar(venta)}
                          >
                            <Check size={14} />
                            {t("cuentas_por_cobrar.marcar_cobrado")}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
      </>
      )}
    </main>
  );
}
