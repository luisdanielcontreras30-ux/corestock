"use client";

import { useState } from "react";
import { Calculator, X } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";
import { useToast } from "../../../components/ToastProvider";
import SelectorPersonalizado, { OpcionSelector } from "../../../components/SelectorPersonalizado";
import { etiquetaUnidad } from "../../../lib/unidadesMedida";
import { formatoMoneda } from "../../ventas/utils";
import { Producto, MateriaPrima, IngredienteReceta } from "../types";

interface Props {
  productos: Producto[];
  materiasPrimas: MateriaPrima[];
  recetas: IngredienteReceta[];
}

export default function CotizacionTab({ productos, materiasPrimas, recetas }: Props) {
  const { t } = useIdioma();
  const { mostrarToast } = useToast();

  const [modoCotizacion, setModoCotizacion] = useState<"producto" | "manual">("producto");
  const [productoCotizacionId, setProductoCotizacionId] = useState("");
  const [materialesManualCotizacion, setMaterialesManualCotizacion] = useState<
    { materiaPrimaId: number; cantidad: number }[]
  >([]);
  const [materiaManualId, setMateriaManualId] = useState("");
  const [cantidadManualCotizacion, setCantidadManualCotizacion] = useState("");
  const [incluirManoObra, setIncluirManoObra] = useState(false);
  const [costoManoObraCotizacion, setCostoManoObraCotizacion] = useState("");

  const productosConReceta = productos.filter((p) => recetas.some((r) => r.producto_id === p.id));

  // En modo "producto" reusa la receta ya guardada; en modo "manual"
  // arma el costo con la lista que se va agregando en pantalla —
  // ninguno de los dos casos toca la base de datos, es solo una
  // calculadora.
  const materialesCotizacion: { materiaPrimaId: number; cantidad: number }[] =
    modoCotizacion === "producto"
      ? // Suma por materia prima en vez de mapear directo — una receta
        // guardada antes de que existiera el chequeo de duplicados en
        // "Agregar a la receta" puede tener dos filas de la misma
        // materia prima; sin sumarlas, la clave de React repetida hacía
        // que solo se viera una fila mientras el total sí contaba las
        // dos, y la lista no cuadraba con el costo mostrado.
        Array.from(
          recetas
            .filter((r) => r.producto_id === Number(productoCotizacionId))
            .reduce((mapa, r) => {
              mapa.set(r.materia_prima_id, (mapa.get(r.materia_prima_id) ?? 0) + r.cantidad_por_unidad);
              return mapa;
            }, new Map<number, number>()),
          ([materiaPrimaId, cantidad]) => ({ materiaPrimaId, cantidad })
        )
      : // Si una materia prima de la lista manual se borra en Stock
        // mientras esta cotización sigue abierta, se filtra en vez de
        // mostrarse como una fila rota con costo en $0.
        materialesManualCotizacion.filter((m) => materiasPrimas.some((mp) => mp.id === m.materiaPrimaId));

  const costoMaterialesCotizacion = materialesCotizacion.reduce((suma, m) => {
    const materiaPrima = materiasPrimas.find((mp) => mp.id === m.materiaPrimaId);
    return suma + m.cantidad * (materiaPrima?.costo_unitario ?? 0);
  }, 0);

  // Number("-50") es un número válido (no NaN) — sin el Math.max, un
  // costo de mano de obra negativo restaba del total en vez de sumarlo.
  const costoManoObraNum = incluirManoObra ? Math.max(0, Number(costoManoObraCotizacion) || 0) : 0;
  const costoTotalCotizacion = costoMaterialesCotizacion + costoManoObraNum;

  const productoCotizacionSeleccionado = productos.find((p) => p.id === Number(productoCotizacionId));

  // Sugerencia de referencia: costo + un margen orientativo (40%), y si
  // ya hay un precio de venta cargado, nunca por debajo de ese precio
  // actual + 15% — para que siempre se vea como una subida sugerida,
  // no un número que podría quedar más bajo que lo que ya cobra hoy.
  // Solo aplica en modo "producto" — sin este chequeo, el precio del
  // último producto visto en ese modo se quedaba pegado al cambiar a
  // "manual", inflando la sugerencia con un precio que ya no aplica.
  const precioActualCotizacion = modoCotizacion === "producto" ? productoCotizacionSeleccionado?.precio_venta ?? 0 : 0;
  const precioSugeridoCotizacion =
    costoTotalCotizacion > 0 ? Math.max(costoTotalCotizacion * 1.4, precioActualCotizacion * 1.15) : 0;

  function agregarMaterialManual() {
    const materiaPrima = materiasPrimas.find((m) => m.id === Number(materiaManualId));
    const cantidad = Number(cantidadManualCotizacion);

    if (!materiaPrima) {
      mostrarToast(t("fabricacion.msg_falta_seleccion"), "error");
      return;
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      mostrarToast(t("fabricacion.msg_cantidad_invalida"), "error");
      return;
    }

    // El chequeo de duplicado se repite dentro del actualizador de
    // estado (no solo contra la variable de arriba) — un doble clic
    // rápido dispara dos llamadas a esta función antes de que React
    // vuelva a renderizar, y ambas leerían la misma lista "vieja" sin
    // el material todavía agregado, dejando pasar la misma materia
    // prima dos veces.
    let duplicado = false;
    setMaterialesManualCotizacion((anteriores) => {
      if (anteriores.some((m) => m.materiaPrimaId === materiaPrima.id)) {
        duplicado = true;
        return anteriores;
      }
      return [...anteriores, { materiaPrimaId: materiaPrima.id, cantidad }];
    });

    if (duplicado) {
      mostrarToast(t("fabricacion.cotizacion_material_duplicado"), "error");
      return;
    }

    setMateriaManualId("");
    setCantidadManualCotizacion("");
  }

  function quitarMaterialManual(materiaPrimaId: number) {
    setMaterialesManualCotizacion((anteriores) => anteriores.filter((m) => m.materiaPrimaId !== materiaPrimaId));
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <Calculator size={18} /> {t("fabricacion.cotizacion")}
      </h2>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>{t("fabricacion.cotizacion_desc")}</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          type="button"
          className={modoCotizacion === "producto" ? "btn-primary" : "btn-secondary"}
          onClick={() => setModoCotizacion("producto")}
        >
          {t("fabricacion.cotizacion_modo_producto")}
        </button>
        <button
          type="button"
          className={modoCotizacion === "manual" ? "btn-primary" : "btn-secondary"}
          onClick={() => setModoCotizacion("manual")}
        >
          {t("fabricacion.cotizacion_modo_manual")}
        </button>
      </div>

      {modoCotizacion === "producto" ? (
        <SelectorPersonalizado value={productoCotizacionId} onChange={setProductoCotizacionId}>
          <OpcionSelector value="">{t("fabricacion.selecciona_producto_con_receta")}</OpcionSelector>
          {productosConReceta.map((p) => (
            <OpcionSelector key={p.id} value={p.id}>
              {p.nombre}
            </OpcionSelector>
          ))}
        </SelectorPersonalizado>
      ) : (
        <>
          <div className="productos-grid">
            <SelectorPersonalizado value={materiaManualId} onChange={setMateriaManualId}>
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
              value={cantidadManualCotizacion}
              onChange={(e) => setCantidadManualCotizacion(e.target.value)}
              placeholder={t("fabricacion.cotizacion_cantidad_placeholder")}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={agregarMaterialManual}>
              {t("fabricacion.cotizacion_agregar_material")}
            </button>
          </div>
        </>
      )}

      {modoCotizacion === "manual" && materialesCotizacion.length === 0 && (
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 16 }}>
          {t("fabricacion.cotizacion_sin_materiales")}
        </p>
      )}

      {materialesCotizacion.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {materialesCotizacion.map((m) => {
            const materiaPrima = materiasPrimas.find((mp) => mp.id === m.materiaPrimaId);
            return (
              <div
                key={m.materiaPrimaId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12.5,
                  color: "var(--text-secondary)",
                }}
              >
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {materiaPrima?.nombre ?? "—"} · {m.cantidad} {materiaPrima ? etiquetaUnidad(materiaPrima.unidad, t) : ""}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {formatoMoneda(m.cantidad * (materiaPrima?.costo_unitario ?? 0))}
                  {modoCotizacion === "manual" && (
                    <button
                      type="button"
                      className="btn-delete"
                      aria-label={t("productos.eliminar")}
                      onClick={() => quitarMaterialManual(m.materiaPrimaId)}
                      style={{ width: 22, height: 22, padding: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <X size={11} />
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={incluirManoObra}
          onChange={(e) => setIncluirManoObra(e.target.checked)}
          style={{ width: "auto" }}
        />
        {t("fabricacion.cotizacion_incluir_mano_obra")}
      </label>

      {incluirManoObra && (
        <input
          type="number"
          min="0"
          step="0.01"
          value={costoManoObraCotizacion}
          onChange={(e) => setCostoManoObraCotizacion(e.target.value)}
          placeholder={t("fabricacion.cotizacion_costo_mano_obra_placeholder")}
          style={{ marginTop: 8 }}
        />
      )}

      {costoTotalCotizacion > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="fabricacion-costo-chip">
            <span>{t("fabricacion.cotizacion_costo_total")}</span>
            <span>{formatoMoneda(costoTotalCotizacion)}</span>
          </div>

          {modoCotizacion === "producto" && precioActualCotizacion > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 14px", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>{t("fabricacion.cotizacion_precio_actual")}</span>
              <span>{formatoMoneda(precioActualCotizacion)}</span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              padding: "10px 14px",
              background: "color-mix(in srgb, var(--modulo-color) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--modulo-color) 40%, transparent)",
              borderRadius: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, fontWeight: 700, color: "var(--modulo-color)" }}>
              <span>{t("fabricacion.cotizacion_precio_sugerido")}</span>
              <span>{formatoMoneda(precioSugeridoCotizacion)}</span>
            </div>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{t("fabricacion.cotizacion_precio_sugerido_nota")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
