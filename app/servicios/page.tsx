"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Wrench, Trash2, CalendarClock, Wallet, ClipboardList, Check, Zap, Plus, X } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import TarjetaDesplegable from "../../components/TarjetaDesplegable";
import RequierePlus from "../../components/RequierePlus";
import CampoConSugerencias from "../../components/CampoConSugerencias";
import CargandoLista from "../../components/CargandoLista";
import FilaVacia from "../../components/FilaVacia";
import { ClienteOpcion, EstadoTrabajo, Trabajo, PlantillaServicio } from "./types";
import {
  cargarDatos,
  registrarTrabajo,
  cambiarEstadoTrabajo,
  eliminarTrabajo,
  crearPlantilla,
  eliminarPlantilla,
  registrarServicioRapido,
} from "./acciones";
import { formatoMoneda } from "../ventas/utils";
import { exportarExcel } from "./utils";

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ServiciosPage() {
  return (
    <RequierePlus>
      <ServiciosContenido />
    </RequierePlus>
  );
}

function ServiciosContenido() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<ClienteOpcion[]>([]);
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaServicio[]>([]);

  const [mostrarFormPlantilla, setMostrarFormPlantilla] = useState(false);
  const [nombrePlantilla, setNombrePlantilla] = useState("");
  const [precioPlantilla, setPrecioPlantilla] = useState("");
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  // Plantilla que se está cobrando o borrando ahora mismo — bloquea
  // solo ese chip, mismo criterio que procesandoId para la tabla.
  const [procesandoPlantillaId, setProcesandoPlantillaId] = useState<number | null>(null);

  const [clienteId, setClienteId] = useState<number | null>(null);
  const [clienteNombre, setClienteNombre] = useState("");
  const [servicio, setServicio] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [precio, setPrecio] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  // Id del trabajo cuyo estado se está cambiando o borrando en este
  // momento — deshabilita SOLO los botones de esa fila mientras la
  // petición está en camino, para que dos clics rápidos (o un dedo
  // lento en celular) no disparen dos peticiones sobre el mismo
  // trabajo a la vez.
  const [procesandoId, setProcesandoId] = useState<number | null>(null);

  // acciones.ts lanza sentinels sin traducir (ver comentario en
  // lib/errores.ts) — esta función los traduce; null si el error no es
  // ninguno de los esperados.
  function mensajeTrabajo(error: unknown): string | null {
    if (!(error instanceof Error)) return null;
    switch (error.message) {
      case "FALTA_CLIENTE":
        return t("servicios.msg_falta_cliente");
      case "FALTA_SERVICIO":
        return t("servicios.msg_falta_servicio");
      case "PRECIO_INVALIDO":
        return t("servicios.msg_precio_invalido");
      default:
        return null;
    }
  }

  async function obtenerDatos() {
    setLoading(true);
    try {
      const datos = await cargarDatos();
      setClientes(datos.clientes);
      setTrabajos(datos.trabajos);
      setPlantillas(datos.plantillas);
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

  function alCambiarClienteNombre(nombre: string) {
    setClienteNombre(nombre);
    const encontrado = clientes.find((c) => c.nombre.toLowerCase() === nombre.toLowerCase());
    setClienteId(encontrado ? encontrado.id : null);
  }

  function limpiar() {
    setClienteId(null);
    setClienteNombre("");
    setServicio("");
    setFecha(hoyISO());
    setPrecio("");
    setNotas("");
  }

  async function guardar() {
    if (guardando) return;

    const precioNum = Number(precio);

    if (!clienteNombre.trim()) {
      mostrarToast(t("servicios.msg_falta_cliente"), "error");
      return;
    }
    if (!servicio.trim()) {
      mostrarToast(t("servicios.msg_falta_servicio"), "error");
      return;
    }
    if (!Number.isFinite(precioNum) || precioNum < 0) {
      mostrarToast(t("servicios.msg_precio_invalido"), "error");
      return;
    }

    try {
      setGuardando(true);
      await registrarTrabajo(clienteId, clienteNombre, servicio, fecha, precioNum, notas);
      limpiar();
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      mostrarToast(mensajeTrabajo(error) || t("servicios.msg_error_registrar"), "error");
    } finally {
      setGuardando(false);
    }
  }

  async function avanzarEstado(trabajo: Trabajo) {
    if (procesandoId !== null) return;

    const siguiente: EstadoTrabajo | null =
      trabajo.estado === "pendiente" ? "hecho" : trabajo.estado === "hecho" ? "cobrado" : null;
    if (!siguiente) return;

    setProcesandoId(trabajo.id);
    try {
      await cambiarEstadoTrabajo(trabajo.id, siguiente);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      mostrarToast(t("servicios.msg_error_estado"), "error");
    } finally {
      setProcesandoId(null);
    }
  }

  async function borrar(id: number) {
    if (procesandoId !== null) return;
    if (!(await confirmar(t("servicios.confirmar_eliminar"), { peligroso: true }))) return;

    setProcesandoId(id);
    try {
      await eliminarTrabajo(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      mostrarToast(t("servicios.msg_error_eliminar"), "error");
    } finally {
      setProcesandoId(null);
    }
  }

  async function cobrarPlantilla(plantilla: PlantillaServicio) {
    if (procesandoPlantillaId !== null) return;

    setProcesandoPlantillaId(plantilla.id);
    try {
      await registrarServicioRapido(plantilla.nombre, plantilla.precio);
      await obtenerDatos();
      mostrarToast(t("servicios.msg_cobrado_rapido").replace("{servicio}", plantilla.nombre), "exito");
    } catch (error) {
      console.error(error);
      mostrarToast(t("servicios.msg_error_registrar"), "error");
    } finally {
      setProcesandoPlantillaId(null);
    }
  }

  async function agregarPlantilla() {
    if (guardandoPlantilla) return;

    const precioNum = Number(precioPlantilla);

    if (!nombrePlantilla.trim()) {
      mostrarToast(t("servicios.msg_falta_nombre_plantilla"), "error");
      return;
    }
    if (!Number.isFinite(precioNum) || precioNum <= 0) {
      mostrarToast(t("servicios.msg_precio_invalido"), "error");
      return;
    }

    try {
      setGuardandoPlantilla(true);
      await crearPlantilla(nombrePlantilla, precioNum);
      setNombrePlantilla("");
      setPrecioPlantilla("");
      setMostrarFormPlantilla(false);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      mostrarToast(t("servicios.msg_error_plantilla"), "error");
    } finally {
      setGuardandoPlantilla(false);
    }
  }

  async function borrarPlantilla(id: number) {
    if (procesandoPlantillaId !== null) return;
    if (!(await confirmar(t("servicios.confirmar_eliminar_plantilla"), { peligroso: true }))) return;

    setProcesandoPlantillaId(id);
    try {
      await eliminarPlantilla(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      mostrarToast(t("servicios.msg_error_plantilla"), "error");
    } finally {
      setProcesandoPlantillaId(null);
    }
  }

  // Resumen del mes con lo que YA está cargado: ninguna consulta nueva.
  //
  // fecha_cobro (no fecha) decide si un trabajo cuenta en "cobrado este
  // mes": fecha es la fecha del TRABAJO, elegida a mano en el
  // formulario, y no cambia cuando el trabajo pasa a "cobrado" después
  // — un trabajo con fecha de la semana pasada cobrado hoy quedaba
  // fuera del mes equivocado. Se usa fecha ?? fecha_cobro solo como
  // respaldo para trabajos marcados "cobrado" antes de que existiera
  // esta columna (ver supabase_servicios_fecha_cobro.sql).
  //
  // Es una fecha de calendario (input type="date"), no un instante —
  // comparar el ISO completo contra un inicio de mes calculado en hora
  // LOCAL (como hacía esto antes) desalinea los dos lados del huso
  // horario: en cualquier país al oeste de UTC, un trabajo cobrado el
  // día 1 se guarda como "...T00:00:00Z" pero inicioMes cae varias
  // horas más tarde ese mismo día, así que la comparación lo dejaba
  // fuera de "cobrado este mes". Comparando solo la fecha (YYYY-MM-DD)
  // de los dos lados, sin hora ni huso, no hay ambigüedad que resolver.
  const resumen = useMemo(() => {
    const ahora = new Date();
    const inicioMes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-01`;
    let cobradoMes = 0;
    let pendientes = 0;
    for (const trab of trabajos) {
      const fechaCobro = trab.fecha_cobro ?? trab.fecha;
      if (trab.estado === "cobrado" && fechaCobro.slice(0, 10) >= inicioMes) {
        cobradoMes += Number(trab.precio) || 0;
      }
      if (trab.estado !== "cobrado") {
        pendientes += 1;
      }
    }
    return { cobradoMes, pendientes, total: trabajos.length };
  }, [trabajos]);

  const trabajosFiltrados = useMemo(
    () =>
      trabajos.filter((trab) => {
        const termino = busqueda.toLowerCase().trim();
        if (!termino) return true;
        return (
          trab.cliente_nombre.toLowerCase().includes(termino) ||
          trab.servicio.toLowerCase().includes(termino)
        );
      }),
    [trabajos, busqueda]
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
        Icono={Wrench}
        color="#65a30d"
        titulo={t("sidebar.servicios")}
        subtitulo={t("servicios.subtitulo")}
      />

      <div className="modulo-resumen">
        <div className="modulo-resumen-item">
          <span className="modulo-resumen-icono">
            <Wallet size={17} />
          </span>
          <div>
            <span className="modulo-resumen-valor">{formatoMoneda(resumen.cobradoMes)}</span>
            <span className="modulo-resumen-etiqueta">{t("servicios.resumen_cobrado_mes")}</span>
          </div>
        </div>
        <div className="modulo-resumen-item">
          <span className="modulo-resumen-icono">
            <CalendarClock size={17} />
          </span>
          <div>
            <span className="modulo-resumen-valor">{resumen.pendientes}</span>
            <span className="modulo-resumen-etiqueta">{t("servicios.resumen_pendientes")}</span>
          </div>
        </div>
        <div className="modulo-resumen-item">
          <span className="modulo-resumen-icono">
            <ClipboardList size={17} />
          </span>
          <div>
            <span className="modulo-resumen-valor">{resumen.total}</span>
            <span className="modulo-resumen-etiqueta">{t("servicios.resumen_total")}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={18} /> {t("servicios.rapidos_titulo")}
          </h2>
          <button
            className="btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={() => setMostrarFormPlantilla((v) => !v)}
          >
            {mostrarFormPlantilla ? <X size={14} /> : <Plus size={14} />}
            {t("servicios.rapidos_agregar")}
          </button>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
          {t("servicios.rapidos_ayuda")}
        </p>

        {mostrarFormPlantilla && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <input
              value={nombrePlantilla}
              onChange={(e) => setNombrePlantilla(e.target.value)}
              placeholder={t("servicios.rapidos_nombre_placeholder")}
              style={{ flex: 1, minWidth: 160 }}
            />
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={precioPlantilla}
              onChange={(e) => setPrecioPlantilla(e.target.value)}
              placeholder={t("servicios.precio")}
              style={{ maxWidth: 140 }}
            />
            <button className="btn-primary" onClick={agregarPlantilla} disabled={guardandoPlantilla}>
              {guardandoPlantilla ? t("servicios.guardando") : t("servicios.rapidos_agregar")}
            </button>
          </div>
        )}

        {plantillas.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("servicios.rapidos_sin_plantillas")}</p>
        ) : (
          <div className="serv-rapidos-grid">
            {plantillas.map((plantilla) => (
              <div key={plantilla.id} className="serv-rapido-chip">
                <button
                  type="button"
                  className="serv-rapido-boton"
                  disabled={procesandoPlantillaId !== null}
                  onClick={() => cobrarPlantilla(plantilla)}
                >
                  <span className="serv-rapido-nombre">{plantilla.nombre}</span>
                  <span className="serv-rapido-precio">{formatoMoneda(plantilla.precio)}</span>
                </button>
                <button
                  type="button"
                  className="serv-rapido-borrar"
                  aria-label={t("productos.eliminar")}
                  disabled={procesandoPlantillaId !== null}
                  onClick={() => borrarPlantilla(plantilla.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <TarjetaDesplegable
        Icono={Wrench}
        titulo={t("servicios.registrar")}
        subtitulo={t("servicios.registrar_ayuda")}
      >
        <div className="productos-grid">
          <CampoConSugerencias
            value={clienteNombre}
            onChange={alCambiarClienteNombre}
            opciones={clientes.map((c) => c.nombre)}
            placeholder={t("servicios.cliente_placeholder")}
          />

          <input
            value={servicio}
            onChange={(e) => setServicio(e.target.value)}
            placeholder={t("servicios.servicio_placeholder")}
          />

          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />

          <input
            type="number"
            min="0"
            step="0.01"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder={t("servicios.precio")}
          />
        </div>

        <input
          style={{ marginTop: 12 }}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder={t("servicios.notas_placeholder")}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? t("servicios.guardando") : t("servicios.registrar")}
          </button>
        </div>
      </TarjetaDesplegable>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input
          style={{ flex: 1, minWidth: 200 }}
          placeholder={t("servicios.buscar")}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        {trabajosFiltrados.length > 0 && (
          <button className="btn-secondary" onClick={() => exportarExcel(trabajosFiltrados)}>
            {t("productos.exportar_excel")}
          </button>
        )}
      </div>

      {loading ? (
        <CargandoLista />
      ) : (
        <div className="tabla">
          <table>
            <thead>
              <tr>
                <th>{t("tabla.fecha")}</th>
                <th>{t("servicios.col_cliente")}</th>
                <th>{t("servicios.col_servicio")}</th>
                <th>{t("servicios.precio")}</th>
                <th>{t("servicios.col_estado")}</th>
                <th>{t("productos.col_acciones")}</th>
              </tr>
            </thead>

            <tbody>
              {trabajosFiltrados.length === 0 ? (
                <FilaVacia
                  colSpan={6}
                  mensaje={trabajos.length === 0 ? t("servicios.sin_trabajos") : t("servicios.sin_resultados_busqueda")}
                />
              ) : (
                trabajosFiltrados.map((trab) => (
                  <tr key={trab.id}>
                    <td>{new Date(trab.fecha).toLocaleDateString()}</td>
                    <td>{trab.cliente_nombre || "—"}</td>
                    <td>{trab.servicio}</td>
                    <td>{formatoMoneda(Number(trab.precio))}</td>
                    <td>
                      <span className={`serv-estado serv-estado-${trab.estado}`}>
                        {t(`servicios.estado_${trab.estado}`)}
                      </span>
                    </td>
                    <td>
                      <div className="productos-actions">
                        {trab.estado !== "cobrado" && (
                          <button
                            className="btn-success"
                            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                            onClick={() => avanzarEstado(trab)}
                            disabled={procesandoId !== null}
                          >
                            <Check size={13} />
                            {t(`servicios.marcar_${trab.estado === "pendiente" ? "hecho" : "cobrado"}`)}
                          </button>
                        )}
                        <button
                          className="btn-delete"
                          onClick={() => borrar(trab.id)}
                          disabled={procesandoId !== null}
                          aria-label={t("productos.eliminar")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
