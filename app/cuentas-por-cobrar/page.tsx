"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, Check, ChevronDown, CalendarClock} from "lucide-react";
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
import CargandoLista from "../../components/CargandoLista";

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
  // Momento contra el que se mide la antigüedad. Se fija al cargar los
  // datos y no se lee en cada render: leer el reloj mientras se dibuja
  // hace que dos tarjetas de la misma lista puedan calcular días
  // distintos, y es impuro (el lint del repo lo marca).
  const [referenciaFecha, setReferenciaFecha] = useState(0);
  const [cobrando, setCobrando] = useState<number | null>(null);

  async function obtenerDatos() {
    setLoading(true);
    setError(false);
    try {
      const datos = await cargarPendientes();
      setVentas(datos);
      setReferenciaFecha(Date.now());
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

      // ventas.total es numeric en Postgres — PostgREST lo devuelve como
      // string, no como number (a pesar de lo que dice VentaFiada). Sumar
      // sin convertir concatenaba texto en vez de sumar ("0" + "150.00"),
      // mismo motivo por el que el resto del código ya envuelve esto en
      // Number(...) antes de acumular (ver Caja, Asistente, etc.).
      actual.totalPendiente += Number(venta.total);
      actual.ventas.push(venta);
      porCliente.set(clave, actual);
    }

    return Array.from(porCliente.values()).sort((a, b) => b.totalPendiente - a.totalPendiente);
  }, [ventas, t]);

  const totalPendiente = useMemo(() => ventas.reduce((acc, v) => acc + Number(v.total), 0), [ventas]);

  // Referencia para marcar "debe mucho" en rojo: no hay forma de saber
  // qué es "mucho" en términos absolutos (cada negocio y moneda es
  // distinto), así que se compara contra el promedio de las propias
  // deudas pendientes del negocio en vez de inventar un monto fijo.
  const promedioPendiente = useMemo(
    () => (deudas.length ? totalPendiente / deudas.length : 0),
    [deudas, totalPendiente]
  );

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
        <CargandoLista />
      </main>
    );
  }

  return (
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <EncabezadoModulo
        Icono={HandCoins}
        color="#facc15"
        titulo={t("sidebar.cuentas_por_cobrar")}
        subtitulo={t("cuentas_por_cobrar.subtitulo")}
      />

      {loading ? (
        <CargandoLista />
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
            background: "rgba(250, 204, 21, 0.15)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <HandCoins size={24} color="#facc15" />
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
          <TarjetaDeuda
            key={deuda.clienteId ?? deuda.nombre}
            deuda={deuda}
            puedeCobrar={puedeCobrar}
            cobrando={cobrando}
            onCobrar={cobrar}
            referenciaFecha={referenciaFecha}
            promedioPendiente={promedioPendiente}
            t={t}
          />
        ))
      )}
      </>
      )}
    </main>
  );
}


// Umbrales de días para clasificar la deuda por color. NO son fechas de
// vencimiento: CoreStock no guarda plazos de crédito por cliente, así
// que inventarse un "vencida" sería afirmar algo que el sistema no
// sabe. Lo que sí sabe es cuánto lleva sin cobrarse (y cuánto es, en
// comparación con el resto), y eso es lo que se colorea.
const DIAS_VERDE = 7;
const DIAS_ROJO = 30;
// Cuánto más grande que el promedio de las deudas actuales tiene que
// ser un saldo para contar como "debe mucho" y resaltarse en rojo
// aunque sea reciente.
const MULTIPLO_DEBE_MUCHO = 2;

type Severidad = "baja" | "media" | "alta";

function TarjetaDeuda({
  deuda,
  puedeCobrar,
  cobrando,
  onCobrar,
  referenciaFecha,
  promedioPendiente,
  t,
}: {
  deuda: DeudaCliente;
  puedeCobrar: boolean;
  cobrando: number | null;
  onCobrar: (venta: VentaFiada) => void;
  referenciaFecha: number;
  promedioPendiente: number;
  t: (clave: string) => string;
}) {
  const [abierta, setAbierta] = useState(false);

  const masAntigua = deuda.ventas.reduce(
    (min, v) => (v.fecha < min ? v.fecha : min),
    deuda.ventas[0]?.fecha ?? ""
  );
  const dias =
    masAntigua && referenciaFecha
      ? Math.floor((referenciaFecha - new Date(masAntigua).getTime()) / 86400000)
      : 0;
  const debeMucho = promedioPendiente > 0 && deuda.totalPendiente >= promedioPendiente * MULTIPLO_DEBE_MUCHO;
  const severidad: Severidad =
    dias >= DIAS_ROJO || debeMucho ? "alta" : dias < DIAS_VERDE ? "baja" : "media";

  // La inicial como avatar: con diez clientes en la lista, un círculo
  // con letra se localiza de un vistazo mejor que diez filas de texto.
  const inicial = deuda.nombre.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={`card deuda-tarjeta ${abierta ? "deuda-tarjeta-abierta" : ""}`}>
      <button
        type="button"
        className="deuda-cabecera"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
      >
        <span className={`deuda-avatar deuda-avatar-${severidad}`}>{inicial}</span>

        <span className="deuda-datos">
          <span className="deuda-nombre-fila">
            <span className="deuda-nombre">{deuda.nombre}</span>
            <span className={`deuda-insignia deuda-insignia-${severidad}`}>
              {t(`cuentas_por_cobrar.insignia_${severidad}`)}
            </span>
          </span>
          <span className="deuda-meta">
            <CalendarClock size={13} />
            {t("cuentas_por_cobrar.dias_sin_cobrar").replace("{dias}", String(dias))}
            {" · "}
            {t("cuentas_por_cobrar.n_pendientes").replace("{n}", String(deuda.ventas.length))}
          </span>
        </span>

        <span className="deuda-monto">
          <span className="deuda-monto-etiqueta">{t("cuentas_por_cobrar.saldo_pendiente")}</span>
          <span className={`deuda-monto-valor deuda-monto-${severidad}`}>
            {formatoMoneda(deuda.totalPendiente)}
          </span>
        </span>

        <ChevronDown size={20} className="deuda-flecha" aria-hidden="true" />
      </button>

      {abierta && (
        <div className="deuda-cuerpo">
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
                          onClick={() => onCobrar(venta)}
                        >
                          <Check size={14} />
                          {t("cuentas_por_cobrar.marcar_cobrado")}
                        </button>
                      ) : (
                        "\u2014"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
