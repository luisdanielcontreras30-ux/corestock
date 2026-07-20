"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Files, Trash2 } from "lucide-react";
import { mensajeErrorSeguro } from "../../lib/errores";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import RequierePlus from "../../components/RequierePlus";
import { FacturaGlobal } from "./types";
import { formatoMoneda } from "../ventas/utils";
import {
  cargarFacturasGlobales,
  generarFacturaGlobal,
  eliminarFacturaGlobal,
} from "./acciones";

function folioDe(id: number) {
  return `FG-${String(id).padStart(6, "0")}`;
}

export default function FacturasGlobalesPage() {
  return (
    <RequierePlus>
      <FacturasGlobalesContenido />
    </RequierePlus>
  );
}

function FacturasGlobalesContenido() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [globales, setGlobales] = useState<FacturaGlobal[]>([]);

  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [nota, setNota] = useState("");
  const [generando, setGenerando] = useState(false);

  async function obtenerDatos() {
    setLoading(true);
    try {
      const datos = await cargarFacturasGlobales();
      setGlobales(datos);
    } catch (error) {
      console.error(error);
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

  async function generar() {
    if (generando) return;

    if (!fechaInicio || !fechaFin) {
      mostrarToast(t("facturas_globales.msg_faltan_fechas"), "error");
      return;
    }

    if (fechaInicio > fechaFin) {
      mostrarToast(t("facturas_globales.msg_rango_invalido"), "error");
      return;
    }

    try {
      setGenerando(true);
      await generarFacturaGlobal(fechaInicio, fechaFin, nota);

      setFechaInicio("");
      setFechaFin("");
      setNota("");
      await obtenerDatos();
    } catch (error) {
      console.error(error);

      if (error instanceof Error && error.message === "SIN_VENTAS_EN_RANGO") {
        mostrarToast(t("facturas_globales.msg_sin_ventas_rango"), "error");
      } else {
        const detalle = mensajeErrorSeguro(error);
        mostrarToast(detalle || t("facturas_globales.msg_error_generar"), "error");
      }
    } finally {
      setGenerando(false);
    }
  }

  async function borrar(id: number) {
    if (!(await confirmar(t("facturas_globales.confirmar_eliminar"), { peligroso: true }))) return;

    try {
      await eliminarFacturaGlobal(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      mostrarToast(t("facturas_globales.msg_error_eliminar"), "error");
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
        Icono={Files}
        color="#d946ef"
        titulo={t("sidebar.facturas_globales")}
        subtitulo={t("facturas_globales.subtitulo")}
      />

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{t("facturas_globales.generar")}</h2>

        <div className="productos-grid">
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {t("promociones.fecha_inicio")}
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {t("promociones.fecha_fin")}
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>
        </div>

        <input
          style={{ marginTop: 12 }}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder={t("compras.nota_placeholder")}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn-primary" onClick={generar} disabled={generando}>
            {generando ? t("compras.guardando") : t("facturas_globales.generar")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card">{t("header.cargando")}</div>
      ) : (
      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>{t("facturas.col_folio")}</th>
              <th>{t("promociones.col_vigencia")}</th>
              <th>{t("facturas_globales.col_cantidad")}</th>
              <th>{t("tabla.total")}</th>
              <th>{t("ajustes_stock.col_motivo")}</th>
              <th>{t("productos.col_acciones")}</th>
            </tr>
          </thead>

          <tbody>
            {globales.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  {t("facturas_globales.sin_globales")}
                </td>
              </tr>
            ) : (
              globales.map((g) => (
                <tr key={g.id}>
                  <td>{folioDe(g.id)}</td>
                  <td>
                    {new Date(g.fecha_inicio).toLocaleDateString()} —{" "}
                    {new Date(g.fecha_fin).toLocaleDateString()}
                  </td>
                  <td>{g.cantidad_ventas}</td>
                  <td style={{ fontWeight: 700, color: "var(--primary)" }}>
                    {formatoMoneda(Number(g.total))}
                  </td>
                  <td>{g.nota || "—"}</td>
                  <td>
                    <button
                      className="btn-delete"
                      aria-label={t("productos.eliminar")}
                      onClick={() => borrar(g.id)}
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
      )}
    </main>
  );
}
