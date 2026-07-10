"use client";

import { useEffect, useState } from "react";
import ClienteForm from "./components/ClienteForm";
import ClientesTabla from "./components/ClientesTabla";
import HistorialModal from "./components/HistorialModal";

import {
  cargarClientes,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
  cargarHistorialCompras,
} from "./acciones";

import {
  ClienteConResumen,
  CompraCliente,
  DatosClienteForm,
} from "./types";
import { useIdioma } from "../../components/LanguageProvider";

const DATOS_VACIOS: DatosClienteForm = {
  nombre: "",
  telefono: "",
  correo: "",
  notas: "",
};

export default function ClientesPage() {
  const { t } = useIdioma();
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<ClienteConResumen[]>([]);

  const [datos, setDatos] = useState<DatosClienteForm>(DATOS_VACIOS);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const [clienteHistorial, setClienteHistorial] =
    useState<ClienteConResumen | null>(null);
  const [compras, setCompras] = useState<CompraCliente[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  async function obtenerDatos() {
    setLoading(true);

    const { clientes: clientesCargados } = await cargarClientes();
    setClientes(clientesCargados);

    setLoading(false);
  }

  useEffect(() => {
    obtenerDatos();
  }, []);

  async function guardarCliente() {
    if (!datos.nombre.trim()) {
      alert(t("clientes.msg_nombre_requerido"));
      return;
    }

    try {
      setGuardando(true);

      if (editandoId) {
        await actualizarCliente(editandoId, datos);
      } else {
        await crearCliente(datos);
      }

      cancelarEdicion();
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(t("clientes.msg_error_guardar"));
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

  async function borrarCliente(id: number) {
    if (!confirm(t("clientes.confirmar_eliminar"))) {
      return;
    }

    try {
      await eliminarCliente(id);
      await obtenerDatos();
    } catch (error: any) {
      console.error(error);

      if (error?.code === "23503") {
        alert(t("clientes.msg_error_fk"));
      } else {
        alert(t("clientes.msg_error_eliminar"));
      }
    }
  }

  async function verHistorial(cliente: ClienteConResumen) {
    setClienteHistorial(cliente);
    setCargandoHistorial(true);

    try {
      const datos = await cargarHistorialCompras(cliente.id);
      setCompras(datos);
    } catch (error) {
      console.error(error);
      setCompras([]);
    } finally {
      setCargandoHistorial(false);
    }
  }

  const clientesFiltrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <main
      className="fade-up"
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      <div>
        <h1 style={{ fontSize: 34, fontWeight: 700 }}>
          {t("clientes.titulo")}
        </h1>

        <p style={{ color: "var(--text-secondary)" }}>
          {t("clientes.subtitulo")}
        </p>
      </div>

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
        <div className="card">{t("header.cargando")}</div>
      ) : (
        <ClientesTabla
          clientes={clientesFiltrados}
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
