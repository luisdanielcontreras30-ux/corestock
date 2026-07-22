"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Users } from "lucide-react";
import ClienteForm from "./components/ClienteForm";
import ClientesTabla from "./components/ClientesTabla";
import HistorialModal from "./components/HistorialModal";
import EncabezadoModulo from "../../components/EncabezadoModulo";

import {
  cargarClientes,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
  cargarHistorialCompras,
} from "./acciones";
import CargandoLista from "../../components/CargandoLista";

import {
  ClienteConResumen,
  CompraCliente,
  DatosClienteForm,
} from "./types";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";

const DATOS_VACIOS: DatosClienteForm = {
  nombre: "",
  telefono: "",
  correo: "",
  notas: "",
};

export default function ClientesPage() {
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [clientes, setClientes] = useState<ClienteConResumen[]>([]);

  const [datos, setDatos] = useState<DatosClienteForm>(DATOS_VACIOS);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const [clienteHistorial, setClienteHistorial] =
    useState<ClienteConResumen | null>(null);
  const [compras, setCompras] = useState<CompraCliente[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  // Si se abre el historial de un cliente y, antes de que cargue, se
  // abre el de otro, la respuesta del primero puede resolver después
  // y pisar `compras` con datos de otro cliente mientras el modal ya
  // muestra el encabezado del segundo. Este ref guarda cuál fue la
  // última solicitud para descartar respuestas que ya no aplican.
  const idHistorialSolicitadoRef = useRef<number | null>(null);

  async function obtenerDatos() {
    setLoading(true);
    setError(false);

    try {
      const { clientes: clientesCargados } = await cargarClientes();
      setClientes(clientesCargados);
    } catch (error) {
      console.error(error);
      setError(true);
      mostrarToast(t("clientes.msg_error_cargar"), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    obtenerDatos();
  }, []);

  async function guardarCliente() {
    if (guardando) return;

    if (!datos.nombre.trim()) {
      mostrarToast(t("clientes.msg_nombre_requerido"), "error");
      return;
    }

    try {
      setGuardando(true);

      if (editandoId !== null) {
        await actualizarCliente(editandoId, datos);
      } else {
        await crearCliente(datos);
      }

      cancelarEdicion();
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      mostrarToast(t("clientes.msg_error_guardar"), "error");
    } finally {
      setGuardando(false);
    }
  }

  function editarCliente(cliente: ClienteConResumen) {
    setEditandoId(cliente.id);
    setDatos({
      nombre: cliente.nombre,
      telefono: cliente.telefono ?? "",
      correo: cliente.correo ?? "",
      notas: cliente.notas ?? "",
    });
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setDatos(DATOS_VACIOS);
  }

  async function borrarCliente(id: number, nombre: string) {
    if (!(await confirmar(t("clientes.confirmar_eliminar").replace("{nombre}", nombre), { peligroso: true }))) {
      return;
    }

    try {
      await eliminarCliente(id);
      await obtenerDatos();
    } catch (error: unknown) {
      console.error(error);

      const codigo = error && typeof error === "object" && "code" in error ? error.code : null;

      if (codigo === "23503") {
        mostrarToast(t("clientes.msg_error_fk"), "error");
      } else {
        mostrarToast(t("clientes.msg_error_eliminar"), "error");
      }
    }
  }

  async function verHistorial(cliente: ClienteConResumen) {
    idHistorialSolicitadoRef.current = cliente.id;
    setClienteHistorial(cliente);
    setCargandoHistorial(true);

    try {
      const datos = await cargarHistorialCompras(cliente.id);
      if (idHistorialSolicitadoRef.current !== cliente.id) return;
      setCompras(datos);
    } catch (error) {
      if (idHistorialSolicitadoRef.current !== cliente.id) return;
      console.error(error);
      setCompras([]);
      mostrarToast(t("comun.msg_error_cargar_datos"), "error");
    } finally {
      if (idHistorialSolicitadoRef.current === cliente.id) {
        setCargandoHistorial(false);
      }
    }
  }

  const clientesFiltrados = useMemo(
    () => clientes.filter((c) => c.nombre.toLowerCase().includes(busqueda.toLowerCase())),
    [clientes, busqueda]
  );

  return (
    <main
      className="fade-up"
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      <EncabezadoModulo
        Icono={Users}
        color="#ec4899"
        titulo={t("clientes.titulo")}
        subtitulo={t("clientes.subtitulo")}
      />

      <ClienteForm
        datos={datos}
        setDatos={setDatos}
        editando={editandoId !== null}
        guardando={guardando}
        onGuardar={guardarCliente}
        onCancelar={cancelarEdicion}
      />

      <input
        placeholder={t("clientes.buscar")}
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {loading ? (
        <CargandoLista />
      ) : error ? (
        <div className="card" style={{ textAlign: "center", padding: "50px 20px" }}>
          <p style={{ color: "#ef4444", marginBottom: 14 }}>{t("clientes.msg_error_cargar")}</p>
          <button className="btn-primary" onClick={obtenerDatos}>
            {t("empresa.reintentar")}
          </button>
        </div>
      ) : (
        <ClientesTabla
          clientes={clientesFiltrados}
          hayClientesRegistrados={clientes.length > 0}
          onVerHistorial={verHistorial}
          onEditar={editarCliente}
          onEliminar={borrarCliente}
        />
      )}

      {clienteHistorial && (
        <HistorialModal
          cliente={clienteHistorial}
          compras={compras}
          cargando={cargandoHistorial}
          onClose={() => setClienteHistorial(null)}
        />
      )}
    </main>
  );
}
