"use client";

import { Fragment, useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { Venta } from "./types";
import {
  formatoFecha,
  formatoMoneda,
  CLAVE_METODO_PAGO,
  agruparPorFecha,
} from "./utils";
import { useIdioma } from "../../components/LanguageProvider";

interface Props {
  ventas: Venta[];
  eliminarVenta?: (id: number) => void;
  exportarExcel?: () => void;
}

export default function Historial({
  ventas,
  eliminarVenta,
  exportarExcel,
}: Props) {
  const { t } = useIdioma();
  const [busqueda, setBusqueda] = useState("");
  const mostrarAcciones = !!eliminarVenta;

  // Sin useMemo, esta lista completa se recalculaba en cada render
  // (incluida cada tecla escrita en el formulario de nueva venta, que
  // vive en el mismo padre y no tiene nada que ver con este filtro).
  const ventasFiltradas = useMemo(() => {
    const termino = busqueda.toLowerCase().trim();
    if (!termino) return ventas;

    return ventas.filter((venta) => {
      const nombreCliente = (venta.clientes?.nombre ?? t("ventas.cliente_general")).toLowerCase();
      return (
        nombreCliente.includes(termino) ||
        venta.producto.toLowerCase().includes(termino)
      );
    });
  }, [ventas, busqueda, t]);

  // Separa la lista en secciones por fecha (Hoy, Ayer, Últimos 7 días,
  // Anteriores) en vez de un solo bloque continuo — más fácil de
  // escanear cuando el historial es largo.
  const gruposFecha = useMemo(
    () =>
      agruparPorFecha(ventasFiltradas, (venta) => venta.fecha, {
        hoy: t("tabla.grupo_hoy"),
        ayer: t("tabla.grupo_ayer"),
        ultimos7Dias: t("tabla.grupo_ultimos_7_dias"),
        anteriores: t("tabla.grupo_anteriores"),
      }),
    [ventasFiltradas, t]
  );

  return (
    <div className="card fade-up">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            {t("ventas.historial_titulo")}
          </h2>

          <p
            style={{
              color: "var(--text-secondary)",
            }}
          >
            {t("ventas.historial_subtitulo")}
          </p>
        </div>

        {exportarExcel && (
          <button
            className="btn-primary"
            onClick={exportarExcel}
          >
            {t("ventas.exportar_excel")}
          </button>
        )}
      </div>

      <input
        style={{ marginBottom: 20 }}
        placeholder={t("ventas.buscar_historial")}
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {ventasFiltradas.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            padding: "40px 20px",
            color: "var(--text-secondary)",
          }}
        >
          <Inbox size={26} color="var(--text-muted)" />
          <span>{ventas.length === 0 ? t("ventas.sin_ventas") : t("ventas.sin_resultados_busqueda")}</span>
        </div>
      ) : (
        gruposFecha.map((grupo) => (
          <Fragment key={grupo.etiqueta}>
            <h3 className="historial-grupo-titulo">{grupo.etiqueta}</h3>

            <div className="historial-grid">
              {grupo.items.map((venta) => (
                <div className="historial-tarjeta" key={venta.id}>
                  <div className="historial-tarjeta-top">
                    <span className="historial-tarjeta-fecha">{formatoFecha(venta.fecha)}</span>
                    <span className="historial-tarjeta-metodo">
                      {t(CLAVE_METODO_PAGO[venta.metodo_pago] ?? CLAVE_METODO_PAGO.efectivo)}
                    </span>
                  </div>

                  <div className="historial-tarjeta-cliente">
                    {venta.clientes?.nombre ?? t("ventas.cliente_general")}
                  </div>

                  <div className="historial-tarjeta-producto">
                    <span>{venta.producto}</span>
                    <span className="historial-tarjeta-cantidad">×{venta.cantidad}</span>
                  </div>

                  <div className="historial-tarjeta-footer">
                    <span className="historial-tarjeta-precio">
                      {formatoMoneda(venta.precio)} {t("ventas.precio_unidad")}
                    </span>
                    <span className="historial-tarjeta-total">{formatoMoneda(venta.total)}</span>
                  </div>

                  {mostrarAcciones && (
                    <button
                      className="btn-delete historial-tarjeta-eliminar"
                      onClick={() => eliminarVenta!(venta.id)}
                    >
                      {t("ventas.eliminar")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Fragment>
        ))
      )}
    </div>
  );
}
