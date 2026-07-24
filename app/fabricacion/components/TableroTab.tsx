"use client";

import { Boxes, BookOpen, PackagePlus } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";
import { LOCALES } from "../../../lib/i18n";
import { MateriaPrima, Produccion } from "../types";
import { etiquetaUnidad } from "../../../lib/unidadesMedida";

interface Props {
  materiasPrimas: MateriaPrima[];
  producciones: Produccion[];
  totalRecetas: number;
}

export default function TableroTab({ materiasPrimas, producciones, totalRecetas }: Props) {
  const { t, idioma } = useIdioma();
  const actividadReciente = producciones.slice(0, 8);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="fabricacion-metricas-grid">
        <div className="fabricacion-metrica">
          <div className="fabricacion-metrica-icono" style={{ background: "rgba(234, 88, 12, 0.12)", color: "#ea580c" }}>
            <Boxes size={18} />
          </div>
          <div>
            <span>{materiasPrimas.length}</span>
            <h3>{t("fabricacion.materias_primas")}</h3>
          </div>
        </div>
        <div className="fabricacion-metrica">
          <div className="fabricacion-metrica-icono" style={{ background: "rgba(124, 108, 255, 0.14)", color: "#7c6cff" }}>
            <BookOpen size={18} />
          </div>
          <div>
            <span>{totalRecetas}</span>
            <h3>{t("fabricacion.recetas")}</h3>
          </div>
        </div>
        <div className="fabricacion-metrica">
          <div className="fabricacion-metrica-icono" style={{ background: "rgba(16, 185, 129, 0.14)", color: "#10b981" }}>
            <PackagePlus size={18} />
          </div>
          <div>
            <span>{producciones.length}</span>
            <h3>{t("fabricacion.total_producciones")}</h3>
          </div>
        </div>
      </div>

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
        <h2 style={{ marginBottom: 16 }}>{t("fabricacion.actividad_reciente")}</h2>
        {actividadReciente.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: 13.5 }}>{t("fabricacion.sin_producciones")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {actividadReciente.map((p) => (
              <div key={p.id} className="fabricacion-actividad-fila">
                <div className="fabricacion-actividad-icono">
                  <PackagePlus size={15} />
                </div>
                <span className="fabricacion-actividad-nombre">{p.producto_nombre}</span>
                <span className="fabricacion-actividad-cantidad">{p.cantidad}</span>
                <span className="fabricacion-actividad-fecha">
                  {new Date(p.fecha).toLocaleDateString(LOCALES[idioma], { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
