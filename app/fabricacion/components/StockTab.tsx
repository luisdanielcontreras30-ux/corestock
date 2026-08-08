"use client";

import { RefObject } from "react";
import { Trash2, Boxes } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";
import SelectorPersonalizado, { OpcionSelector } from "../../../components/SelectorPersonalizado";
import { UNIDADES_MEDIDA, etiquetaUnidad } from "../../../lib/unidadesMedida";
import { formatoMoneda } from "../../ventas/utils";
import { MateriaPrima } from "../types";

interface Props {
  materiasPrimas: MateriaPrima[];
  nombreMpRef: RefObject<HTMLInputElement | null>;
  nombreMP: string;
  onCambiarNombre: (valor: string) => void;
  unidadMP: string;
  onCambiarUnidad: (valor: string) => void;
  stockMP: string;
  onCambiarStock: (valor: string) => void;
  costoMP: string;
  onCambiarCosto: (valor: string) => void;
  guardandoMP: boolean;
  onGuardar: () => void;
  onBorrar: (id: number) => void;
}

export default function StockTab({
  materiasPrimas,
  nombreMpRef,
  nombreMP,
  onCambiarNombre,
  unidadMP,
  onCambiarUnidad,
  stockMP,
  onCambiarStock,
  costoMP,
  onCambiarCosto,
  guardandoMP,
  onGuardar,
  onBorrar,
}: Props) {
  const { t } = useIdioma();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{t("fabricacion.stock_disponible")}</h2>
        {materiasPrimas.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: 13.5 }}>{t("fabricacion.sin_materias_primas")}</p>
        ) : (
          <div className="fabricacion-stock-grid">
            {materiasPrimas.map((m) => (
              <div key={m.id} className="fabricacion-stock-card">
                <div className="fabricacion-stock-card-icono">
                  <Boxes size={18} />
                </div>
                <span className="fabricacion-stock-card-nombre">{m.nombre}</span>
                <span className="fabricacion-stock-card-cantidad">
                  {m.stock} {etiquetaUnidad(m.unidad, t)}
                </span>
                <span className="fabricacion-stock-card-etiqueta">{t("fabricacion.disponible")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{t("fabricacion.materias_primas")}</h2>

        <div className="productos-grid">
          <input
            ref={nombreMpRef}
            value={nombreMP}
            onChange={(e) => onCambiarNombre(e.target.value)}
            placeholder={t("fabricacion.nombre_mp_placeholder")}
          />
          <SelectorPersonalizado value={unidadMP} onChange={onCambiarUnidad}>
            <OpcionSelector value="">{t("fabricacion.unidad_placeholder")}</OpcionSelector>
            {UNIDADES_MEDIDA.map((u) => (
              <OpcionSelector key={u} value={u}>
                {t(`unidad.${u}`)}
              </OpcionSelector>
            ))}
          </SelectorPersonalizado>
          <input
            type="number"
            min="0"
            step="0.01"
            value={stockMP}
            onChange={(e) => onCambiarStock(e.target.value)}
            placeholder={t("fabricacion.stock_inicial")}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={costoMP}
            onChange={(e) => onCambiarCosto(e.target.value)}
            placeholder={t("compras.costo_unitario")}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn-primary" onClick={onGuardar} disabled={guardandoMP}>
            {guardandoMP ? t("compras.guardando") : t("fabricacion.agregar_mp")}
          </button>
        </div>

        <div className="tabla" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>{t("promociones.col_nombre")}</th>
                <th>{t("fabricacion.col_unidad")}</th>
                <th>{t("dashboard.stock_actual")}</th>
                <th>{t("compras.costo_unitario")}</th>
                <th>{t("productos.col_acciones")}</th>
              </tr>
            </thead>
            <tbody>
              {materiasPrimas.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                    {t("fabricacion.sin_materias_primas")}
                  </td>
                </tr>
              ) : (
                materiasPrimas.map((m) => (
                  <tr key={m.id}>
                    <td>{m.nombre}</td>
                    <td>{etiquetaUnidad(m.unidad, t)}</td>
                    <td>{m.stock}</td>
                    <td>{formatoMoneda(Number(m.costo_unitario))}</td>
                    <td>
                      <button
                        className="btn-delete"
                        aria-label={t("productos.eliminar")}
                        onClick={() => onBorrar(m.id)}
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
      </div>
    </div>
  );
}
