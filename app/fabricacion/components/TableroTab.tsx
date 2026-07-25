"use client";

import { useMemo, useState } from "react";
import { Search, Package, Check, AlertTriangle, PackagePlus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";
import { useToast } from "../../../components/ToastProvider";
import { mensajeErrorSeguro } from "../../../lib/errores";
import { normalizarTexto } from "../../../lib/normalizarTexto";
import { etiquetaUnidad } from "../../../lib/unidadesMedida";
import { formatoMoneda } from "../../ventas/utils";
import { LOCALES } from "../../../lib/i18n";
import SelectorPersonalizado, { OpcionSelector } from "../../../components/SelectorPersonalizado";
import { Producto, MateriaPrima, IngredienteReceta, Produccion } from "../types";
import { producir, ErrorStockInsuficienteMateria } from "../acciones";

interface Props {
  productos: Producto[];
  materiasPrimas: MateriaPrima[];
  recetas: IngredienteReceta[];
  producciones: Produccion[];
  onProducido: () => Promise<void>;
  productoSeleccionadoId: string;
  onSeleccionarProducto: (id: string) => void;
  busqueda: string;
  onCambiarBusqueda: (valor: string) => void;
  materiaRecetaId: string;
  onSeleccionarMateria: (id: string) => void;
  cantidadPorUnidad: string;
  onCambiarCantidad: (valor: string) => void;
  guardandoIngrediente: boolean;
  onGuardarIngrediente: () => void;
  onBorrarIngrediente: (id: number) => void;
  pasoMovil: 1 | 2 | 3 | 4;
  onCambiarPasoMovil: (paso: 1 | 2 | 3 | 4) => void;
}

const ACCESOS_RAPIDOS = [10, 50, 100, 500];

export default function TableroTab({
  productos,
  materiasPrimas,
  recetas,
  producciones,
  onProducido,
  productoSeleccionadoId,
  onSeleccionarProducto,
  busqueda,
  onCambiarBusqueda,
  materiaRecetaId,
  onSeleccionarMateria,
  cantidadPorUnidad,
  onCambiarCantidad,
  guardandoIngrediente,
  onGuardarIngrediente,
  onBorrarIngrediente,
  pasoMovil,
  onCambiarPasoMovil,
}: Props) {
  const { t, idioma } = useIdioma();
  const { mostrarToast } = useToast();

  const [cantidadAProducir, setCantidadAProducir] = useState("");
  const [produciendo, setProduciendo] = useState(false);

  function seleccionarProducto(id: string) {
    onSeleccionarProducto(id);
    onCambiarPasoMovil(2);
  }

  function avanzarAResumen() {
    if (!Number.isFinite(cantidadProducirNum) || cantidadProducirNum <= 0) {
      mostrarToast(t("fabricacion.msg_cantidad_invalida"), "error");
      return;
    }
    if (!Number.isInteger(cantidadProducirNum)) {
      mostrarToast(t("comun.msg_cantidad_entera"), "error");
      return;
    }
    onCambiarPasoMovil(4);
  }

  // producir() lanza sentinels sin traducir (ver comentario en
  // lib/errores.ts) para los casos donde sí hay un mensaje pensado para
  // mostrarse — esta función los traduce; null si no es ninguno de los
  // esperados (deja pasar a mensajeErrorSeguro/fallback).
  function mensajeProducir(error: unknown): string | null {
    if (error instanceof ErrorStockInsuficienteMateria) {
      return `${t("fabricacion.msg_stock_insuficiente_materia")} "${error.materiaPrimaNombre}" — ${t("fabricacion.necesitas")} ${error.necesario}, ${t("fabricacion.disponible_actual")} ${error.disponible}.`;
    }
    if (!(error instanceof Error)) return null;
    switch (error.message) {
      case "CANTIDAD_INVALIDA":
        return t("fabricacion.msg_cantidad_invalida");
      case "SIN_RECETA":
        return t("fabricacion.sin_receta");
      case "STOCK_CAMBIO":
        return t("comun.msg_stock_cambio");
      default:
        return null;
    }
  }

  const productosFiltrados = useMemo(() => {
    const termino = normalizarTexto(busqueda.trim());
    if (!termino) return productos;
    return productos.filter((p) => normalizarTexto(p.nombre).includes(termino));
  }, [productos, busqueda]);

  const productoSeleccionado = productos.find((p) => p.id === Number(productoSeleccionadoId));
  const ingredientesAProducir = recetas.filter((r) => r.producto_id === Number(productoSeleccionadoId));
  // Math.max(0, ...) — el input tiene min="1" pero eso no bloquea
  // escribir "-5" a mano; sin el clamp, "necesario" salía negativo y
  // la tabla de ingredientes mostraba ✓ (negativo siempre es menor
  // que el disponible) con cantidades sin sentido.
  const cantidadProducirNum = Math.max(0, Number(cantidadAProducir) || 0);

  const costoTotalProduccion = ingredientesAProducir.reduce((suma, ing) => {
    const materiaPrima = materiasPrimas.find((m) => m.id === ing.materia_prima_id);
    return suma + ing.cantidad_por_unidad * cantidadProducirNum * (materiaPrima?.costo_unitario ?? 0);
  }, 0);

  const todoAlcanza = ingredientesAProducir.every((ing) => {
    const materiaPrima = materiasPrimas.find((m) => m.id === ing.materia_prima_id);
    const necesario = ing.cantidad_por_unidad * cantidadProducirNum;
    return (materiaPrima?.stock ?? 0) >= necesario;
  });

  const costoPorUnidadReceta = ingredientesAProducir.reduce((suma, r) => {
    const materiaPrima = materiasPrimas.find((m) => m.id === r.materia_prima_id);
    return suma + r.cantidad_por_unidad * (materiaPrima?.costo_unitario ?? 0);
  }, 0);

  async function confirmarProduccion() {
    if (produciendo || !productoSeleccionado) return;

    if (!Number.isFinite(cantidadProducirNum) || cantidadProducirNum <= 0) {
      mostrarToast(t("fabricacion.msg_cantidad_invalida"), "error");
      return;
    }
    if (!Number.isInteger(cantidadProducirNum)) {
      mostrarToast(t("comun.msg_cantidad_entera"), "error");
      return;
    }

    try {
      setProduciendo(true);
      await producir(productoSeleccionado, cantidadProducirNum, ingredientesAProducir);
      mostrarToast(t("fabricacion.msg_produccion_confirmada"), "exito");
      onSeleccionarProducto("");
      setCantidadAProducir("");
      onCambiarPasoMovil(1);
      await onProducido();
    } catch (error) {
      console.error(error);
      const detalle = mensajeProducir(error) || mensajeErrorSeguro(error);
      mostrarToast(detalle || t("fabricacion.msg_error_producir"), "error");
    } finally {
      setProduciendo(false);
    }
  }

  const actividadReciente = producciones.slice(0, 8);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="fabricacion-panel-produccion">
        <div className={`card fabricacion-panel-col${pasoMovil !== 1 ? " fabricacion-paso-inactivo-movil" : ""}`}>
          <h2 style={{ marginBottom: 12 }}>{t("fabricacion.selecciona_receta")}</h2>
          <div className="fabricacion-buscador">
            <Search size={15} className="fabricacion-buscador-icono" />
            <input value={busqueda} onChange={(e) => onCambiarBusqueda(e.target.value)} placeholder={t("comun.buscar")} />
          </div>
          <div className="fabricacion-lista-productos">
            {productosFiltrados.length === 0 ? (
              <p className="fabricacion-panel-placeholder">{t("comun.sin_resultados")}</p>
            ) : (
              productosFiltrados.map((p) => {
                const tieneReceta = recetas.some((r) => r.producto_id === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`fabricacion-item-producto${p.id === Number(productoSeleccionadoId) ? " fabricacion-item-producto-activo" : ""}`}
                    onClick={() => seleccionarProducto(String(p.id))}
                  >
                    <div className="fabricacion-item-producto-icono">
                      <Package size={16} />
                    </div>
                    <div className="fabricacion-item-producto-texto">
                      <span className="fabricacion-item-producto-nombre">{p.nombre}</span>
                      <span className="fabricacion-insignia">{p.categoria?.trim() || t("productos.sin_categoria")}</span>
                    </div>
                    {tieneReceta && <span className="fabricacion-punto-activo" aria-hidden="true" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className={`card fabricacion-panel-col${pasoMovil !== 2 ? " fabricacion-paso-inactivo-movil" : ""}`}>
          <h2 style={{ marginBottom: 12 }}>{t("fabricacion.ingredientes_de_receta")}</h2>
          {!productoSeleccionado ? (
            <p className="fabricacion-panel-placeholder">{t("fabricacion.selecciona_producto")}</p>
          ) : (
            <>
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
                    {ingredientesAProducir.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>
                          {t("fabricacion.sin_receta")}
                        </td>
                      </tr>
                    ) : (
                      ingredientesAProducir.map((ing) => {
                        const materiaPrima = materiasPrimas.find((m) => m.id === ing.materia_prima_id);
                        const unidad = materiaPrima ? etiquetaUnidad(materiaPrima.unidad, t) : "";
                        return (
                          <tr key={ing.id}>
                            <td>{ing.materia_prima_nombre}</td>
                            <td>
                              {ing.cantidad_por_unidad} {unidad}
                            </td>
                            <td>
                              <button
                                className="btn-delete"
                                aria-label={t("productos.eliminar")}
                                onClick={() => onBorrarIngrediente(ing.id)}
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

              {ingredientesAProducir.length > 0 && (
                <div className="fabricacion-costo-chip" style={{ marginTop: 12 }}>
                  <span>{t("fabricacion.costo_por_unidad")}</span>
                  <span>{formatoMoneda(costoPorUnidadReceta)}</span>
                </div>
              )}

              {ingredientesAProducir.length > 0 && cantidadProducirNum > 0 && (
                <div className={`fabricacion-banner ${todoAlcanza ? "fabricacion-banner-exito" : "fabricacion-banner-alerta"}`}>
                  {todoAlcanza ? <Check size={15} /> : <AlertTriangle size={15} />}
                  {todoAlcanza ? t("fabricacion.todos_disponibles") : t("fabricacion.msg_stock_insuficiente_general")}
                </div>
              )}

              <div className="productos-grid" style={{ marginTop: 16 }}>
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

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button className="btn-secondary" onClick={onGuardarIngrediente} disabled={guardandoIngrediente}>
                  {t("fabricacion.agregar_ingrediente")}
                </button>
              </div>

              <div className="fabricacion-paso-nav-movil">
                <button type="button" className="btn-secondary" onClick={() => onCambiarPasoMovil(1)}>
                  <ChevronLeft size={15} /> {t("comun.atras")}
                </button>
                <button type="button" className="btn-primary" onClick={() => onCambiarPasoMovil(3)}>
                  {t("comun.siguiente")} <ChevronRight size={15} />
                </button>
              </div>
            </>
          )}
        </div>

        <div className={`card fabricacion-panel-col${pasoMovil !== 3 ? " fabricacion-paso-inactivo-movil" : ""}`}>
          <h2 style={{ marginBottom: 12 }}>{t("fabricacion.cantidad_a_producir")}</h2>
          {!productoSeleccionado ? (
            <p className="fabricacion-panel-placeholder">{t("fabricacion.selecciona_producto")}</p>
          ) : (
            <>
              <input
                type="number"
                min="1"
                step="1"
                value={cantidadAProducir}
                onChange={(e) => setCantidadAProducir(e.target.value)}
                placeholder={t("fabricacion.cantidad_a_producir")}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {ACCESOS_RAPIDOS.map((valor) => (
                  <button key={valor} type="button" className="btn-secondary" onClick={() => setCantidadAProducir(String(valor))}>
                    {valor}
                  </button>
                ))}
              </div>

              {cantidadProducirNum > 0 && (
                <div className="fabricacion-costo-chip" style={{ marginTop: 16 }}>
                  <span>{t("fabricacion.rendimiento_estimado")}</span>
                  <span>
                    {cantidadProducirNum} {t("tabla.unidades_abrev")}
                  </span>
                </div>
              )}

              <div className="fabricacion-paso-nav-movil">
                <button type="button" className="btn-secondary" onClick={() => onCambiarPasoMovil(2)}>
                  <ChevronLeft size={15} /> {t("comun.atras")}
                </button>
                <button type="button" className="btn-primary" onClick={avanzarAResumen}>
                  {t("comun.siguiente")} <ChevronRight size={15} />
                </button>
              </div>
            </>
          )}
        </div>

        <div className={`card fabricacion-panel-col${pasoMovil !== 4 ? " fabricacion-paso-inactivo-movil" : ""}`}>
          <h2 style={{ marginBottom: 12 }}>{t("fabricacion.resumen_produccion")}</h2>
          {!productoSeleccionado || cantidadProducirNum <= 0 ? (
            <p className="fabricacion-panel-placeholder">{t("fabricacion.resumen_placeholder")}</p>
          ) : (
            <>
              <div className="fabricacion-resumen-producto">
                <div className="fabricacion-resumen-icono">
                  <Package size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <span className="fabricacion-resumen-nombre">{productoSeleccionado.nombre}</span>
                  <span className="fabricacion-resumen-cantidad">
                    {cantidadProducirNum} {t("tabla.unidades_abrev")}
                  </span>
                </div>
              </div>

              <h3 style={{ margin: "16px 0 8px", fontSize: 13.5 }}>{t("fabricacion.ingredientes_a_usar")}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ingredientesAProducir.map((ing) => {
                  const materiaPrima = materiasPrimas.find((m) => m.id === ing.materia_prima_id);
                  const necesario = ing.cantidad_por_unidad * cantidadProducirNum;
                  return (
                    <div key={ing.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ing.materia_prima_nombre}
                      </span>
                      <span style={{ color: "var(--text-secondary)", flexShrink: 0 }}>
                        {Math.round(necesario * 100) / 100} {materiaPrima ? etiquetaUnidad(materiaPrima.unidad, t) : ""}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="fabricacion-costo-chip" style={{ marginTop: 16 }}>
                <span>{t("fabricacion.costo_total_estimado")}</span>
                <span>{formatoMoneda(costoTotalProduccion)}</span>
              </div>

              {!todoAlcanza && (
                <p style={{ color: "#ef4444", fontSize: 12.5, marginTop: 10 }}>{t("fabricacion.msg_stock_insuficiente_general")}</p>
              )}

              <button
                type="button"
                className="btn-primary"
                onClick={confirmarProduccion}
                disabled={produciendo}
                style={{ marginTop: 16, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <PackagePlus size={16} />
                {produciendo ? t("compras.guardando") : t("fabricacion.confirmar_produccion")}
              </button>

              <div className="fabricacion-paso-nav-movil">
                <button type="button" className="btn-secondary" onClick={() => onCambiarPasoMovil(3)}>
                  <ChevronLeft size={15} /> {t("comun.atras")}
                </button>
              </div>
            </>
          )}
        </div>
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
