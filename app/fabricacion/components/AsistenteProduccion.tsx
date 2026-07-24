"use client";

import { useMemo, useState } from "react";
import { Search, Package, Check, PackagePlus } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";
import { useToast } from "../../../components/ToastProvider";
import { mensajeErrorSeguro } from "../../../lib/errores";
import { normalizarTexto } from "../../../lib/normalizarTexto";
import { etiquetaUnidad } from "../../../lib/unidadesMedida";
import { formatoMoneda } from "../../ventas/utils";
import { Producto, MateriaPrima, IngredienteReceta } from "../types";
import { producir, ErrorStockInsuficienteMateria } from "../acciones";

interface Props {
  productos: Producto[];
  materiasPrimas: MateriaPrima[];
  recetas: IngredienteReceta[];
  onProducido: () => Promise<void>;
}

const ACCESOS_RAPIDOS = [10, 50, 100, 500];

const PASOS: { numero: 1 | 2 | 3 | 4; clave: string; descClave: string }[] = [
  { numero: 1, clave: "fabricacion.paso_receta", descClave: "fabricacion.paso_receta_desc" },
  { numero: 2, clave: "fabricacion.paso_materias", descClave: "fabricacion.paso_materias_desc" },
  { numero: 3, clave: "fabricacion.paso_produccion", descClave: "fabricacion.paso_produccion_desc" },
  { numero: 4, clave: "fabricacion.paso_resumen", descClave: "fabricacion.paso_resumen_desc" },
];

export default function AsistenteProduccion({ productos, materiasPrimas, recetas, onProducido }: Props) {
  const { t } = useIdioma();
  const { mostrarToast } = useToast();

  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1);
  const [busqueda, setBusqueda] = useState("");
  const [productoProducirId, setProductoProducirId] = useState("");
  const [cantidadAProducir, setCantidadAProducir] = useState("");
  const [produciendo, setProduciendo] = useState(false);

  // producir() lanza sentinels sin traducir (ver comentario en
  // lib/errores.ts) para los casos donde sí hay un mensaje pensado
  // para mostrarse — esta función los traduce; null si el error no es
  // ninguno de los esperados (deja pasar a mensajeErrorSeguro/fallback).
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

  const productosConReceta = useMemo(
    () => productos.filter((p) => recetas.some((r) => r.producto_id === p.id)),
    [productos, recetas]
  );

  const productosFiltrados = useMemo(() => {
    const termino = normalizarTexto(busqueda.trim());
    if (!termino) return productosConReceta;
    return productosConReceta.filter((p) => normalizarTexto(p.nombre).includes(termino));
  }, [productosConReceta, busqueda]);

  const productoSeleccionado = productos.find((p) => p.id === Number(productoProducirId));
  const ingredientesAProducir = recetas.filter((r) => r.producto_id === Number(productoProducirId));
  const cantidadProducirNum = Number(cantidadAProducir) || 0;

  const costoTotalProduccion = ingredientesAProducir.reduce((suma, ing) => {
    const materiaPrima = materiasPrimas.find((m) => m.id === ing.materia_prima_id);
    return suma + ing.cantidad_por_unidad * cantidadProducirNum * (materiaPrima?.costo_unitario ?? 0);
  }, 0);

  const todoAlcanza = ingredientesAProducir.every((ing) => {
    const materiaPrima = materiasPrimas.find((m) => m.id === ing.materia_prima_id);
    const necesario = ing.cantidad_por_unidad * cantidadProducirNum;
    return (materiaPrima?.stock ?? 0) >= necesario;
  });

  function reiniciar() {
    setPaso(1);
    setBusqueda("");
    setProductoProducirId("");
    setCantidadAProducir("");
  }

  function irASiguiente() {
    if (paso === 1 && !productoProducirId) {
      mostrarToast(t("fabricacion.msg_selecciona_producto"), "error");
      return;
    }
    if (paso === 3) {
      if (!Number.isFinite(cantidadProducirNum) || cantidadProducirNum <= 0) {
        mostrarToast(t("fabricacion.msg_cantidad_invalida"), "error");
        return;
      }
      if (!Number.isInteger(cantidadProducirNum)) {
        mostrarToast(t("comun.msg_cantidad_entera"), "error");
        return;
      }
    }
    setPaso((p) => (p < 4 ? ((p + 1) as 1 | 2 | 3 | 4) : p));
  }

  function irAAnterior() {
    setPaso((p) => (p > 1 ? ((p - 1) as 1 | 2 | 3 | 4) : p));
  }

  async function confirmarProduccion() {
    if (produciendo || !productoSeleccionado) return;

    try {
      setProduciendo(true);
      await producir(productoSeleccionado, cantidadProducirNum, ingredientesAProducir);
      mostrarToast(t("fabricacion.msg_produccion_confirmada"), "exito");
      reiniciar();
      await onProducido();
    } catch (error) {
      console.error(error);
      const detalle = mensajeProducir(error) || mensajeErrorSeguro(error);
      mostrarToast(detalle || t("fabricacion.msg_error_producir"), "error");
    } finally {
      setProduciendo(false);
    }
  }

  return (
    <div className="card">
      <div className="fabricacion-pasos">
        {PASOS.map((p, indice) => (
          <div key={p.numero} className="fabricacion-paso-item">
            <div className="fabricacion-paso-indicador">
              <div
                className={`fabricacion-paso-circulo${
                  paso === p.numero
                    ? " fabricacion-paso-circulo-activo"
                    : paso > p.numero
                    ? " fabricacion-paso-circulo-hecho"
                    : ""
                }`}
              >
                {paso > p.numero ? <Check size={14} /> : p.numero}
              </div>
              <div className="fabricacion-paso-texto">
                <span className="fabricacion-paso-titulo">{t(p.clave)}</span>
                <span className="fabricacion-paso-desc">{t(p.descClave)}</span>
              </div>
            </div>
            {indice < PASOS.length - 1 && <div className="fabricacion-paso-linea" />}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        {paso === 1 && (
          <div>
            <div className="fabricacion-buscador">
              <Search size={15} className="fabricacion-buscador-icono" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={t("comun.buscar")}
              />
            </div>
            <div className="fabricacion-lista-productos" style={{ marginTop: 12 }}>
              {productosFiltrados.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontSize: 13, padding: "12px 4px" }}>
                  {productosConReceta.length === 0 ? t("fabricacion.sin_recetas_disponibles") : t("comun.sin_resultados")}
                </p>
              ) : (
                productosFiltrados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`fabricacion-item-producto${p.id === Number(productoProducirId) ? " fabricacion-item-producto-activo" : ""}`}
                    onClick={() => setProductoProducirId(String(p.id))}
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
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {paso === 2 && productoSeleccionado && (
          <div className="tabla">
            <table>
              <thead>
                <tr>
                  <th>{t("fabricacion.selecciona_materia_prima")}</th>
                  <th>{t("fabricacion.cantidad_por_unidad")}</th>
                  <th>{t("dashboard.stock_actual")}</th>
                </tr>
              </thead>
              <tbody>
                {ingredientesAProducir.map((ing) => {
                  const materiaPrima = materiasPrimas.find((m) => m.id === ing.materia_prima_id);
                  return (
                    <tr key={ing.id}>
                      <td>{ing.materia_prima_nombre}</td>
                      <td>
                        {ing.cantidad_por_unidad} {materiaPrima ? etiquetaUnidad(materiaPrima.unidad, t) : ""}
                      </td>
                      <td>
                        {materiaPrima?.stock ?? 0} {materiaPrima ? etiquetaUnidad(materiaPrima.unidad, t) : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {paso === 3 && (
          <div>
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
                <button
                  key={valor}
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCantidadAProducir(String(valor))}
                >
                  {valor}
                </button>
              ))}
            </div>

            {cantidadProducirNum > 0 && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                {ingredientesAProducir.map((ing) => {
                  const materiaPrima = materiasPrimas.find((m) => m.id === ing.materia_prima_id);
                  const necesario = ing.cantidad_por_unidad * cantidadProducirNum;
                  const disponible = materiaPrima?.stock ?? 0;
                  const alcanza = disponible >= necesario;

                  return (
                    <div
                      key={ing.id}
                      style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, color: alcanza ? "var(--text-secondary)" : "#ef4444" }}
                    >
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ing.materia_prima_nombre}
                      </span>
                      <span style={{ flexShrink: 0 }}>
                        {Math.round(necesario * 100) / 100} / {disponible} {materiaPrima ? etiquetaUnidad(materiaPrima.unidad, t) : ""}
                      </span>
                    </div>
                  );
                })}

                <div className="fabricacion-costo-chip">
                  <span>{t("fabricacion.costo_total_estimado")}</span>
                  <span>{formatoMoneda(costoTotalProduccion)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {paso === 4 && productoSeleccionado && (
          <div>
            <div className="fabricacion-resumen-producto">
              <div className="fabricacion-resumen-icono">
                <Package size={20} />
              </div>
              <div>
                <span className="fabricacion-resumen-nombre">{productoSeleccionado.nombre}</span>
                <span className="fabricacion-resumen-cantidad">
                  {cantidadProducirNum} {t("tabla.unidades_abrev")}
                </span>
              </div>
            </div>

            <h3 style={{ margin: "20px 0 10px", fontSize: 13.5 }}>{t("fabricacion.ingredientes_a_usar")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ingredientesAProducir.map((ing) => {
                const materiaPrima = materiasPrimas.find((m) => m.id === ing.materia_prima_id);
                const necesario = ing.cantidad_por_unidad * cantidadProducirNum;
                return (
                  <div key={ing.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span>{ing.materia_prima_nombre}</span>
                    <span style={{ color: "var(--text-secondary)" }}>
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
              <p style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>
                {t("fabricacion.msg_stock_insuficiente_general")}
              </p>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
        <button type="button" className="btn-secondary" onClick={irAAnterior} disabled={paso === 1}>
          {t("comun.atras")}
        </button>
        {paso < 4 ? (
          <button type="button" className="btn-primary" onClick={irASiguiente}>
            {t("comun.siguiente")}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={confirmarProduccion}
            disabled={produciendo}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <PackagePlus size={16} />
            {produciendo ? t("compras.guardando") : t("fabricacion.confirmar_produccion")}
          </button>
        )}
      </div>
    </div>
  );
}
