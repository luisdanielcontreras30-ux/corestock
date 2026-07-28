"use client";

import { useState } from "react";
import { Package, Sparkles, Wrench, Plus, Trash2 } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";
import SelectorPersonalizado, { OpcionSelector } from "../../../components/SelectorPersonalizado";
import { formatoMoneda } from "../../ventas/utils";
import { Producto, ItemNuevo, TipoItem } from "../types";

// Los tres tipos de línea que puede llevar una cotización. El icono y el
// color no son adorno: es lo que permite leer de un vistazo qué parte de
// una cotización es mercancía y qué parte es trabajo, que es justo la
// distinción que importa en un taller o un autolavado.
export const ESTILO_TIPO: Record<TipoItem, { color: string; Icono: typeof Package }> = {
  producto: { color: "#3b82f6", Icono: Package },
  servicio: { color: "#a855f7", Icono: Sparkles },
  mano_obra: { color: "#f59e0b", Icono: Wrench },
};

interface Props {
  productos: Producto[];
  items: ItemNuevo[];
  onChange: (items: ItemNuevo[]) => void;
}

export default function ConstructorConceptos({ productos, items, onChange }: Props) {
  const { t } = useIdioma();

  const [tipo, setTipo] = useState<TipoItem>("producto");
  const [productoId, setProductoId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [precio, setPrecio] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cantidadNum = Number(cantidad);
  const precioNum = Number(precio);

  function cambiarTipo(nuevo: TipoItem) {
    setTipo(nuevo);
    setError(null);
    // Los campos no se comparten entre tipos: el nombre de un producto
    // lo pone el catálogo y el de un servicio lo escribe la persona.
    setProductoId("");
    setDescripcion("");
    setPrecio("");
  }

  function alElegirProducto(id: string) {
    setProductoId(id);
    const p = productos.find((x) => x.id === Number(id));
    if (p) setPrecio(String(p.precio_venta));
  }

  function agregar() {
    const producto = productos.find((p) => p.id === Number(productoId));

    if (tipo === "producto" && !producto) {
      setError(t("cotizaciones.msg_selecciona_producto"));
      return;
    }

    const nombre = tipo === "producto" ? (producto?.nombre ?? "") : descripcion.trim();

    if (!nombre) {
      setError(t("cotizaciones.msg_descripcion_vacia"));
      return;
    }

    if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
      setError(t("cotizaciones.msg_cantidad_mayor"));
      return;
    }

    if (!Number.isFinite(precioNum) || precioNum < 0) {
      setError(t("cotizaciones.msg_precio_invalido"));
      return;
    }

    onChange([
      ...items,
      {
        tipo,
        producto_id: tipo === "producto" ? Number(productoId) : null,
        descripcion: nombre,
        cantidad: cantidadNum,
        precio_unitario: precioNum,
      },
    ]);

    setError(null);
    setProductoId("");
    setDescripcion("");
    setCantidad("1");
    setPrecio("");
  }

  function quitar(indice: number) {
    onChange(items.filter((_, i) => i !== indice));
  }

  const total = items.reduce((suma, item) => suma + item.cantidad * item.precio_unitario, 0);

  return (
    <div className="cot-constructor">
      {/* Selector de tipo de concepto */}
      <div className="cot-tipos">
        {(Object.keys(ESTILO_TIPO) as TipoItem[]).map((valor) => {
          const { color, Icono } = ESTILO_TIPO[valor];
          const activo = tipo === valor;

          return (
            <button
              key={valor}
              type="button"
              onClick={() => cambiarTipo(valor)}
              className={`cot-tipo-btn${activo ? " cot-tipo-btn-activo" : ""}`}
              style={
                activo
                  ? { borderColor: color, background: `${color}1a`, color }
                  : undefined
              }
            >
              <Icono size={15} />
              {t(`cotizaciones.tipo_${valor}`)}
            </button>
          );
        })}
      </div>

      <div className="cot-campos">
        {tipo === "producto" ? (
          <SelectorPersonalizado value={productoId} onChange={alElegirProducto}>
            <OpcionSelector value="">{t("cotizaciones.selecciona_producto")}</OpcionSelector>
            {productos.map((p) => (
              <OpcionSelector key={p.id} value={p.id}>
                {p.nombre}
              </OpcionSelector>
            ))}
          </SelectorPersonalizado>
        ) : (
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={
              tipo === "servicio"
                ? t("cotizaciones.placeholder_servicio")
                : t("cotizaciones.placeholder_mano_obra")
            }
          />
        )}

        <input
          type="number"
          min="0"
          // Los servicios se cobran por fracciones (1.5 horas de mano de
          // obra), así que la cantidad no puede estar limitada a enteros
          // como en el resto de la app.
          step={tipo === "producto" ? "1" : "0.5"}
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          placeholder={t("tabla.cantidad")}
          aria-label={t("tabla.cantidad")}
        />

        <input
          type="number"
          min="0"
          step="0.01"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          placeholder={t("cotizaciones.precio_unitario")}
          aria-label={t("cotizaciones.precio_unitario")}
        />

        <button type="button" className="btn-secondary cot-btn-agregar" onClick={agregar}>
          <Plus size={15} />
          {t("cotizaciones.agregar_concepto")}
        </button>
      </div>

      {error && <p className="cot-error">{error}</p>}

      {/* Conceptos ya agregados */}
      {items.length === 0 ? (
        <p className="cot-vacio">{t("cotizaciones.sin_conceptos")}</p>
      ) : (
        <div className="cot-lineas">
          {items.map((item, indice) => {
            const { color, Icono } = ESTILO_TIPO[item.tipo];

            return (
              <div key={indice} className="cot-linea">
                <span className="cot-linea-icono" style={{ background: `${color}1a`, color }}>
                  <Icono size={14} />
                </span>

                <div className="cot-linea-texto">
                  <strong>{item.descripcion}</strong>
                  <small>
                    {item.cantidad} × {formatoMoneda(item.precio_unitario)}
                  </small>
                </div>

                <span className="cot-linea-total">
                  {formatoMoneda(item.cantidad * item.precio_unitario)}
                </span>

                <button
                  type="button"
                  className="btn-delete"
                  aria-label={t("productos.eliminar")}
                  onClick={() => quitar(indice)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}

          <div className="cot-linea cot-linea-total-final">
            <span>{t("tabla.total")}</span>
            <strong>{formatoMoneda(total)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
