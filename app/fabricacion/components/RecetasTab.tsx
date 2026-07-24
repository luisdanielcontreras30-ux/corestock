"use client";

import { useMemo, useState } from "react";
import { Search, Trash2, Package } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";
import SelectorPersonalizado, { OpcionSelector } from "../../../components/SelectorPersonalizado";
import { normalizarTexto } from "../../../lib/normalizarTexto";
import { etiquetaUnidad } from "../../../lib/unidadesMedida";
import { formatoMoneda } from "../../ventas/utils";
import { Producto, MateriaPrima, IngredienteReceta } from "../types";

interface Props {
  productos: Producto[];
  materiasPrimas: MateriaPrima[];
  recetas: IngredienteReceta[];
  productoRecetaId: string;
  onSeleccionarProducto: (id: string) => void;
  materiaRecetaId: string;
  onSeleccionarMateria: (id: string) => void;
  cantidadPorUnidad: string;
  onCambiarCantidad: (valor: string) => void;
  guardandoIngrediente: boolean;
  onGuardarIngrediente: () => void;
  onBorrarIngrediente: (id: number) => void;
}

export default function RecetasTab({
  productos,
  materiasPrimas,
  recetas,
  productoRecetaId,
  onSeleccionarProducto,
  materiaRecetaId,
  onSeleccionarMateria,
  cantidadPorUnidad,
  onCambiarCantidad,
  guardandoIngrediente,
  onGuardarIngrediente,
  onBorrarIngrediente,
}: Props) {
  const { t } = useIdioma();
  const [busqueda, setBusqueda] = useState("");

  const productosFiltrados = useMemo(() => {
    const termino = normalizarTexto(busqueda.trim());
    if (!termino) return productos;
    return productos.filter((p) => normalizarTexto(p.nombre).includes(termino));
  }, [productos, busqueda]);

  const productoSeleccionado = productos.find((p) => p.id === Number(productoRecetaId));

  const recetaSeleccionada = recetas.filter((r) => r.producto_id === Number(productoRecetaId));

  const costoPorUnidadReceta = recetaSeleccionada.reduce((suma, r) => {
    const materiaPrima = materiasPrimas.find((m) => m.id === r.materia_prima_id);
    return suma + r.cantidad_por_unidad * (materiaPrima?.costo_unitario ?? 0);
  }, 0);

  return (
    <div className="fabricacion-recetas-layout">
      <div className="card fabricacion-recetas-lista">
        <h2 style={{ marginBottom: 12 }}>{t("fabricacion.selecciona_receta")}</h2>
        <div className="fabricacion-buscador">
          <Search size={15} className="fabricacion-buscador-icono" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={t("comun.buscar")}
          />
        </div>

        <div className="fabricacion-lista-productos">
          {productosFiltrados.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", fontSize: 13, padding: "12px 4px" }}>
              {t("comun.sin_resultados")}
            </p>
          ) : (
            productosFiltrados.map((p) => {
              const tieneReceta = recetas.some((r) => r.producto_id === p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`fabricacion-item-producto${p.id === Number(productoRecetaId) ? " fabricacion-item-producto-activo" : ""}`}
                  onClick={() => onSeleccionarProducto(String(p.id))}
                >
                  <div className="fabricacion-item-producto-icono">
                    <Package size={16} />
                  </div>
                  <div className="fabricacion-item-producto-texto">
                    <span className="fabricacion-item-producto-nombre">{p.nombre}</span>
                    <span className="fabricacion-insignia">
                      {p.categoria?.trim() || t("productos.sin_categoria")}
                    </span>
                  </div>
                  {tieneReceta && <span className="fabricacion-punto-activo" aria-hidden="true" />}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="card fabricacion-recetas-detalle">
        {!productoSeleccionado ? (
          <p style={{ color: "var(--text-secondary)", fontSize: 13.5 }}>
            {t("fabricacion.selecciona_producto")}
          </p>
        ) : (
          <>
            <h2 style={{ marginBottom: 4 }}>{t("fabricacion.ingredientes_de_receta")}</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
              {productoSeleccionado.nombre}
            </p>

            <div className="tabla">
              <table>
                <thead>
                  <tr>
                    <th>{t("fabricacion.selecciona_materia_prima")}</th>
                    <th>{t("fabricacion.cantidad_por_unidad")}</th>
                    <th>{t("productos.col_acciones")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recetaSeleccionada.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>
                        {t("fabricacion.sin_receta")}
                      </td>
                    </tr>
                  ) : (
                    recetaSeleccionada.map((r) => {
                      const materiaPrima = materiasPrimas.find((m) => m.id === r.materia_prima_id);
                      return (
                        <tr key={r.id}>
                          <td>{r.materia_prima_nombre}</td>
                          <td>
                            {r.cantidad_por_unidad} {materiaPrima ? etiquetaUnidad(materiaPrima.unidad, t) : ""}
                          </td>
                          <td>
                            <button
                              className="btn-delete"
                              aria-label={t("productos.eliminar")}
                              onClick={() => onBorrarIngrediente(r.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {recetaSeleccionada.length > 0 && (
              <div className="fabricacion-costo-chip" style={{ marginTop: 12 }}>
                <span>{t("fabricacion.costo_por_unidad")}</span>
                <span>{formatoMoneda(costoPorUnidadReceta)}</span>
              </div>
            )}

            <div className="productos-grid" style={{ marginTop: 20 }}>
              <SelectorPersonalizado value={materiaRecetaId} onChange={onSeleccionarMateria}>
                <OpcionSelector value="">{t("fabricacion.selecciona_materia_prima")}</OpcionSelector>
                {materiasPrimas.map((m) => (
                  <OpcionSelector key={m.id} value={m.id}>
                    {m.nombre} ({etiquetaUnidad(m.unidad, t)})
                  </OpcionSelector>
                ))}
              </SelectorPersonalizado>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={cantidadPorUnidad}
                onChange={(e) => onCambiarCantidad(e.target.value)}
                placeholder={t("fabricacion.cantidad_por_unidad")}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button className="btn-secondary" onClick={onGuardarIngrediente} disabled={guardandoIngrediente}>
                {t("fabricacion.agregar_ingrediente")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
