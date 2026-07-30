"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Wrench, Trash2, CalendarClock, Wallet, ClipboardList, Check } from "lucide-react";
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
import { ClienteOpcion, EstadoTrabajo, Trabajo } from "./types";
import { cargarDatos, registrarTrabajo, cambiarEstadoTrabajo, eliminarTrabajo } from "./acciones";
import { formatoMoneda } from "../ventas/utils";

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

  const [clienteId, setClienteId] = useState<number | null>(null);
  const [clienteNombre, setClienteNombre] = useState("");
  const [servicio, setServicio] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [precio, setPrecio] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

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
    const siguiente: EstadoTrabajo | null =
      trabajo.estado === "pendiente" ? "hecho" : trabajo.estado === "hecho" ? "cobrado" : null;
    if (!siguiente) return;

    try {
      await cambiarEstadoTrabajo(trabajo.id, siguiente);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      mostrarToast(t("servicios.msg_error_estado"), "error");
    }
  }

  async function borrar(id: number) {
    if (!(await confirmar(t("servicios.confirmar_eliminar"), { peligroso: true }))) return;

    try {
      await eliminarTrabajo(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      mostrarToast(t("servicios.msg_error_eliminar"), "error");
    }
  }

  // Resumen del mes con lo que YA está cargado: ninguna consulta nueva.
  const resumen = useMemo(() => {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
    let cobradoMes = 0;
    let pendientes = 0;
    for (const trab of trabajos) {
      if (trab.estado === "cobrado" && trab.fecha >= inicioMes) {
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
                          >
                            <Check size={13} />
                            {t(`servicios.marcar_${trab.estado === "pendiente" ? "hecho" : "cobrado"}`)}
                          </button>
                        )}
                        <button className="btn-delete" onClick={() => borrar(trab.id)} aria-label={t("productos.eliminar")}>
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
