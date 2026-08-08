"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Check, X, Trash2, ShoppingCart, Share2, AlertTriangle } from "lucide-react";
import { mensajeErrorSeguro } from "../../lib/errores";
import { useAuth } from "../../components/AuthProvider";
import { useMiembroActivo } from "../../components/MiembroActivoProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import RequierePlus from "../../components/RequierePlus";
import SelectorPersonalizado, { OpcionSelector } from "../../components/SelectorPersonalizado";
import CampoConSugerencias from "../../components/CampoConSugerencias";
import CotizacionCompartirModal from "./components/CotizacionCompartirModal";
import ConstructorConceptos, { ESTILO_TIPO, detalleLinea } from "./components/ConstructorConceptos";
import { Producto, Cliente, Cotizacion, EstadoCotizacion, ItemNuevo } from "./types";
import {
  cargarDatos,
  crearCotizacion,
  cambiarEstadoCotizacion,
  eliminarCotizacion,
  convertirEnVenta,
} from "./acciones";
import CargandoLista from "../../components/CargandoLista";
import { exportarExcel } from "./utils";
import { formatoMoneda } from "../ventas/utils";

const COLOR_ESTADO: Record<EstadoCotizacion, string> = {
  pendiente: "#f59e0b",
  aceptada: "#10b981",
  rechazada: "#ef4444",
};

// El folio es lo que convierte una fila de base de datos en un
// documento: le da a la cotización algo que el cliente puede citar por
// teléfono ("la COT-000042").
function folioDe(id: number): string {
  return `COT-${String(id).padStart(6, "0")}`;
}

export default function CotizacionesPage() {
  return (
    <RequierePlus>
      <CotizacionesContenido />
    </RequierePlus>
  );
}

function CotizacionesContenido() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { puede } = useMiembroActivo();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [soportaItems, setSoportaItems] = useState(true);

  const [clienteId, setClienteId] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [items, setItems] = useState<ItemNuevo[]>([]);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [convirtiendoId, setConvirtiendoId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoCotizacion | "">("");
  const [compartiendo, setCompartiendo] = useState<Cotizacion | null>(null);

  // acciones.ts lanza sentinels sin traducir (ver comentario en
  // lib/errores.ts) para los casos donde sí hay un mensaje pensado
  // para mostrarse — esta función los traduce; null si el error no es
  // ninguno de los esperados (deja pasar a mensajeErrorSeguro/fallback).
  function mensajeCotizacion(error: unknown): string | null {
    if (!(error instanceof Error)) return null;
    switch (error.message) {
      case "CANTIDAD_INVALIDA":
        return t("cotizaciones.msg_cantidad_mayor");
      case "PRECIO_INVALIDO":
        return t("cotizaciones.msg_precio_invalido");
      case "DESCRIPCION_VACIA":
        return t("cotizaciones.msg_descripcion_vacia");
      case "SIN_CONCEPTOS":
        return t("cotizaciones.msg_sin_conceptos");
      case "FALTA_MIGRACION_ITEMS":
        return t("cotizaciones.msg_falta_migracion");
      case "NO_ACEPTADA":
        return t("cotizaciones.msg_no_aceptada");
      case "YA_CONVERTIDA":
        return t("cotizaciones.msg_ya_convertida");
      case "YA_ELIMINADA":
        return t("comun.msg_ya_eliminado");
      case "PRODUCTO_NO_EXISTE":
        return t("cotizaciones.msg_producto_no_existe");
      case "STOCK_INSUFICIENTE_CONVERSION":
        return t("cotizaciones.msg_stock_insuficiente");
      case "STOCK_CAMBIO":
        return t("comun.msg_stock_cambio");
      default:
        return null;
    }
  }

  async function obtenerDatos() {
    setLoading(true);
    try {
      const datos = await cargarDatos();
      setProductos(datos.productos);
      setClientes(datos.clientes);
      setCotizaciones(datos.cotizaciones);
      setSoportaItems(datos.soportaItems);
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

  const totalNuevo = items.reduce((suma, i) => suma + i.cantidad * i.precio_unitario, 0);

  function alCambiarClienteNombre(nombre: string) {
    setClienteNombre(nombre);

    const encontrado = clientes.find(
      (c) => c.nombre.toLowerCase() === nombre.toLowerCase()
    );

    setClienteId(encontrado ? String(encontrado.id) : "");
  }

  function limpiar() {
    setClienteId("");
    setClienteNombre("");
    setItems([]);
    setNota("");
  }

  async function guardar() {
    if (guardando) return;

    if (items.length === 0) {
      mostrarToast(t("cotizaciones.msg_sin_conceptos"), "error");
      return;
    }

    try {
      setGuardando(true);
      await crearCotizacion(clienteId ? Number(clienteId) : null, clienteNombre, items, nota);

      limpiar();
      await obtenerDatos();
      mostrarToast(t("cotizaciones.msg_creada"), "exito");
    } catch (error) {
      console.error(error);
      const detalle = mensajeCotizacion(error) || mensajeErrorSeguro(error);
      mostrarToast(detalle || t("cotizaciones.msg_error_guardar"), "error");
    } finally {
      setGuardando(false);
    }
  }

  async function alCambiarEstado(id: number, estado: EstadoCotizacion) {
    if (estado === "rechazada" && !(await confirmar(t("cotizaciones.confirmar_rechazar")))) return;

    try {
      await cambiarEstadoCotizacion(id, estado);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = mensajeCotizacion(error) || mensajeErrorSeguro(error);
      mostrarToast(detalle || t("cotizaciones.msg_error_estado"), "error");
    }
  }

  async function borrar(id: number) {
    if (!(await confirmar(t("cotizaciones.confirmar_eliminar"), { peligroso: true }))) return;

    try {
      await eliminarCotizacion(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = mensajeCotizacion(error) || mensajeErrorSeguro(error);
      mostrarToast(detalle || t("cotizaciones.msg_error_eliminar"), "error");
    }
  }

  async function alConvertirEnVenta(cotizacion: Cotizacion) {
    if (convirtiendoId !== null || !puede("registrar_ventas")) return;
    if (!(await confirmar(t("cotizaciones.confirmar_convertir")))) return;

    try {
      setConvirtiendoId(cotizacion.id);
      await convertirEnVenta(cotizacion);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = mensajeCotizacion(error) || mensajeErrorSeguro(error);
      mostrarToast(detalle || t("cotizaciones.msg_error_convertir"), "error");
    } finally {
      setConvirtiendoId(null);
    }
  }

  const cotizacionesFiltradas = useMemo(
    () =>
      cotizaciones.filter((c) => {
        if (filtroEstado !== "" && c.estado !== filtroEstado) return false;

        const termino = busqueda.toLowerCase().trim();
        if (!termino) return true;

        const nombreCliente = (c.cliente_nombre ?? t("ventas.cliente_general")).toLowerCase();

        return (
          nombreCliente.includes(termino) ||
          folioDe(c.id).toLowerCase().includes(termino) ||
          // Se busca en TODOS los conceptos, no solo en el resumen: con
          // varias líneas, buscar "cera" tiene que encontrar la
          // cotización aunque el resumen diga "detallado de interior".
          c.items.some((i) => i.descripcion.toLowerCase().includes(termino))
        );
      }),
    [cotizaciones, filtroEstado, busqueda, t]
  );

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
        Icono={FileText}
        color="#3b82f6"
        titulo={t("sidebar.cotizaciones")}
        subtitulo={t("cotizaciones.subtitulo")}
      />

      {!soportaItems && (
        <div className="cot-aviso">
          <AlertTriangle size={17} />
          <span>{t("cotizaciones.aviso_migracion")}</span>
        </div>
      )}

      {/* NUEVA COTIZACIÓN — con forma de hoja, no de formulario suelto */}
      <div className="card cot-nueva">
        <div className="cot-nueva-cabecera">
          <div>
            <h2>{t("cotizaciones.registrar")}</h2>
            <p>{t("cotizaciones.nueva_ayuda")}</p>
          </div>
          <span className="cot-folio cot-folio-nuevo">{t("cotizaciones.folio_nuevo")}</span>
        </div>

        <div className="cot-cliente">
          <CampoConSugerencias
            value={clienteNombre}
            onChange={alCambiarClienteNombre}
            opciones={clientes.map((c) => c.nombre)}
            placeholder={t("cotizaciones.para_cliente")}
          />

          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder={t("compras.nota_placeholder")}
          />
        </div>

        <ConstructorConceptos productos={productos} items={items} onChange={setItems} />

        <div className="cot-nueva-pie">
          <span className="cot-nueva-total">
            {t("tabla.total")}: <strong>{formatoMoneda(totalNuevo)}</strong>
          </span>

          <button
            className="btn-primary"
            onClick={guardar}
            disabled={guardando || items.length === 0}
          >
            {guardando ? t("compras.guardando") : t("cotizaciones.registrar")}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input
          style={{ flex: 1, minWidth: 200 }}
          placeholder={t("cotizaciones.buscar")}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <SelectorPersonalizado
          style={{ minWidth: 180 }}
          value={filtroEstado}
          onChange={(v) => setFiltroEstado(v as EstadoCotizacion | "")}
        >
          <OpcionSelector value="">{t("cotizaciones.todos_estados")}</OpcionSelector>
          <OpcionSelector value="pendiente">{t("cotizaciones.estado_pendiente")}</OpcionSelector>
          <OpcionSelector value="aceptada">{t("cotizaciones.estado_aceptada")}</OpcionSelector>
          <OpcionSelector value="rechazada">{t("cotizaciones.estado_rechazada")}</OpcionSelector>
        </SelectorPersonalizado>

        {cotizacionesFiltradas.length > 0 && (
          <button className="btn-secondary" onClick={() => exportarExcel(cotizacionesFiltradas)}>
            {t("productos.exportar_excel")}
          </button>
        )}
      </div>

      {loading ? (
        <CargandoLista />
      ) : cotizacionesFiltradas.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
          {cotizaciones.length === 0
            ? t("cotizaciones.sin_cotizaciones")
            : t("cotizaciones.sin_resultados_busqueda")}
        </div>
      ) : (
        <div className="cot-hojas">
          {cotizacionesFiltradas.map((c) => {
            const color = COLOR_ESTADO[c.estado];

            return (
              <article key={c.id} className="cot-hoja" style={{ ["--cot-acento" as string]: color }}>
                <header className="cot-hoja-cabecera">
                  <div>
                    <span className="cot-folio">{folioDe(c.id)}</span>
                    <time>{new Date(c.fecha).toLocaleDateString()}</time>
                  </div>

                  <div className="cot-hoja-estado">
                    <span className="cot-badge" style={{ background: `${color}1a`, color }}>
                      {t(`cotizaciones.estado_${c.estado}`)}
                    </span>
                    {c.venta_id && (
                      <span className="cot-badge cot-badge-convertida">
                        {t("cotizaciones.convertida_badge")}
                      </span>
                    )}
                  </div>
                </header>

                <p className="cot-hoja-cliente">
                  {c.cliente_nombre || t("ventas.cliente_general")}
                </p>

                <div className="cot-hoja-lineas">
                  {c.items.map((item) => {
                    const { color: colorTipo, Icono } = ESTILO_TIPO[item.tipo];

                    return (
                      <div key={item.id} className="cot-linea">
                        <span
                          className="cot-linea-icono"
                          style={{ background: `${colorTipo}1a`, color: colorTipo }}
                          title={t(`cotizaciones.tipo_${item.tipo}`)}
                        >
                          <Icono size={13} />
                        </span>

                        <div className="cot-linea-texto">
                          <strong>{item.descripcion}</strong>
                          {detalleLinea(item, formatoMoneda) && (
                            <small>{detalleLinea(item, formatoMoneda)}</small>
                          )}
                        </div>

                        <span className="cot-linea-total">
                          {formatoMoneda(item.cantidad * item.precio_unitario)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {c.nota && <p className="cot-hoja-nota">{c.nota}</p>}

                <footer className="cot-hoja-pie">
                  <span className="cot-hoja-total">
                    {t("tabla.total")} <strong>{formatoMoneda(Number(c.total))}</strong>
                  </span>

                  <div className="cot-hoja-acciones">
                    <button
                      className="btn-edit"
                      aria-label={t("cotizaciones.compartir")}
                      onClick={() => setCompartiendo(c)}
                    >
                      <Share2 size={14} />
                    </button>

                    {c.estado === "pendiente" && (
                      <>
                        <button
                          className="btn-success"
                          aria-label={t("cotizaciones.estado_aceptada")}
                          onClick={() => alCambiarEstado(c.id, "aceptada")}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          className="btn-delete"
                          aria-label={t("cotizaciones.estado_rechazada")}
                          onClick={() => alCambiarEstado(c.id, "rechazada")}
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}

                    {c.estado === "aceptada" && !c.venta_id && puede("registrar_ventas") && (
                      <button
                        className="btn-primary"
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px" }}
                        onClick={() => alConvertirEnVenta(c)}
                        disabled={convirtiendoId === c.id}
                      >
                        <ShoppingCart size={14} /> {t("cotizaciones.convertir_venta")}
                      </button>
                    )}

                    <button
                      className="btn-delete"
                      aria-label={t("productos.eliminar")}
                      onClick={() => borrar(c.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {compartiendo && (
        <CotizacionCompartirModal
          cotizacion={compartiendo}
          onClose={() => setCompartiendo(null)}
        />
      )}
    </main>
  );
}
