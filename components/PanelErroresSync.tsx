"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useIdioma } from "./LanguageProvider";
import { useToast } from "./ToastProvider";
import { useConfirm } from "./ConfirmProvider";
import { useSync } from "./SyncProvider";
import {
  listarConError,
  reintentarVenta,
  reintentarCaja,
  descartarVenta,
  descartarCaja,
} from "../lib/sync";
import { VentaPendiente, CajaPendiente } from "../lib/db";
import { formatoMoneda } from "../app/ventas/utils";

const ETIQUETA_TIPO_CAJA: Record<string, string> = {
  apertura: "caja.tipo_apertura",
  entrada: "caja.tipo_entrada",
  salida: "caja.tipo_salida",
  cierre: "caja.tipo_cierre",
};

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

// Ventas y movimientos de caja hechos sin conexión que, al intentar
// sincronizarse, el servidor rechazó de verdad (no un problema de
// red — eso se reintenta solo) — ej. ya no queda stock del producto,
// o la caja ya no tiene saldo suficiente. Sin este panel esas filas
// se quedaban atoradas para siempre en IndexedDB, contando en el
// indicador rojo del encabezado pero sin ninguna forma de revisarlas.
export default function PanelErroresSync({ abierto, onCerrar }: Props) {
  const { user } = useAuth();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();
  const { sincronizarAhora, actualizarContadores } = useSync();

  const [cargando, setCargando] = useState(true);
  const [ventas, setVentas] = useState<VentaPendiente[]>([]);
  const [caja, setCaja] = useState<CajaPendiente[]>([]);
  const [procesando, setProcesando] = useState<string | null>(null);

  async function cargar() {
    if (!user) return;
    setCargando(true);
    try {
      const datos = await listarConError(user.id);
      setVentas(datos.ventas);
      setCaja(datos.caja);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (abierto) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  async function reintentarUno(tipo: "venta" | "caja", uuid: string) {
    setProcesando(uuid);
    try {
      if (tipo === "venta") await reintentarVenta(uuid);
      else await reintentarCaja(uuid);

      await sincronizarAhora();
      await cargar();
    } catch (error) {
      console.error(error);
      mostrarToast(t("sync.msg_error_reintentar"), "error");
    } finally {
      setProcesando(null);
    }
  }

  async function descartarUno(tipo: "venta" | "caja", uuid: string) {
    if (!(await confirmar(t("sync.confirmar_descartar"), { peligroso: true }))) return;

    setProcesando(uuid);
    try {
      if (tipo === "venta") await descartarVenta(uuid);
      else await descartarCaja(uuid);

      await actualizarContadores();
      await cargar();
    } catch (error) {
      console.error(error);
      mostrarToast(t("sync.msg_error_descartar"), "error");
    } finally {
      setProcesando(null);
    }
  }

  if (!abierto) return null;

  const sinNada = !cargando && ventas.length === 0 && caja.length === 0;

  return (
    <div className="factura-overlay" onClick={onCerrar}>
      <div className="factura-modal fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="factura-modal-toolbar">
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={18} color="var(--danger)" />
            {t("sync.errores_titulo")}
          </h3>
          <button className="btn-secondary" onClick={onCerrar}>
            {t("mobile.cerrar")}
          </button>
        </div>

        <div className="sync-errores-lista">
          {cargando ? (
            <p className="sync-errores-vacio">{t("header.cargando")}</p>
          ) : sinNada ? (
            <p className="sync-errores-vacio">{t("sync.sin_errores")}</p>
          ) : (
            <>
              {ventas.map((v) => (
                <div key={v.uuid} className="sync-errores-item">
                  <div className="sync-errores-item-info">
                    <p className="sync-errores-item-titulo">
                      {t("sync.item_venta")}: {v.producto_nombre} x{v.cantidad}
                    </p>
                    <p className="sync-errores-item-detalle">
                      {formatoMoneda(v.precio_unitario * v.cantidad)} · {new Date(v.creado_en).toLocaleString()}
                    </p>
                    <p className="sync-errores-item-error">{v.error}</p>
                  </div>
                  <div className="sync-errores-item-acciones">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={procesando === v.uuid}
                      onClick={() => reintentarUno("venta", v.uuid)}
                      title={t("sync.reintentar")}
                    >
                      <RotateCcw size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn-delete"
                      disabled={procesando === v.uuid}
                      onClick={() => descartarUno("venta", v.uuid)}
                      title={t("sync.descartar")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}

              {caja.map((c) => (
                <div key={c.uuid} className="sync-errores-item">
                  <div className="sync-errores-item-info">
                    <p className="sync-errores-item-titulo">
                      {t("sync.item_caja")}: {t(ETIQUETA_TIPO_CAJA[c.tipo] ?? c.tipo)}{" "}
                      {formatoMoneda(c.monto)}
                    </p>
                    <p className="sync-errores-item-detalle">
                      {c.motivo ? `${c.motivo} · ` : ""}
                      {new Date(c.creado_en).toLocaleString()}
                    </p>
                    <p className="sync-errores-item-error">{c.error}</p>
                  </div>
                  <div className="sync-errores-item-acciones">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={procesando === c.uuid}
                      onClick={() => reintentarUno("caja", c.uuid)}
                      title={t("sync.reintentar")}
                    >
                      <RotateCcw size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn-delete"
                      disabled={procesando === c.uuid}
                      onClick={() => descartarUno("caja", c.uuid)}
                      title={t("sync.descartar")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
