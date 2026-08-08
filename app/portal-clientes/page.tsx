"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCircle, Link2, Check, ExternalLink, RefreshCw } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import RequierePlus from "../../components/RequierePlus";
import { copiarAlPortapapeles } from "../../lib/portapapeles";
import { cargarClientes, regenerarTokenPortal } from "../clientes/acciones";
import { ClienteConResumen } from "../clientes/types";
import CargandoLista from "../../components/CargandoLista";

export default function PortalClientesPage() {
  return (
    <RequierePlus>
      <PortalClientesContenido />
    </RequierePlus>
  );
}

function PortalClientesContenido() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<ClienteConResumen[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [copiadoId, setCopiadoId] = useState<number | null>(null);
  const [regenerandoId, setRegenerandoId] = useState<number | null>(null);

  async function obtenerDatos() {
    setLoading(true);
    try {
      const { clientes: clientesCargados } = await cargarClientes();
      setClientes(clientesCargados);
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

  async function copiarLink(cliente: ClienteConResumen) {
    if (!cliente.token) {
      mostrarToast(t("clientes.token_pendiente"), "error");
      return;
    }

    const enlace = `${window.location.origin}/portal-clientes/${cliente.token}`;
    const exito = await copiarAlPortapapeles(enlace);

    if (!exito) {
      mostrarToast(t("comun.msg_error_copiar"), "error");
      return;
    }

    setCopiadoId(cliente.id);
    setTimeout(() => setCopiadoId((actual) => (actual === cliente.id ? null : actual)), 2000);
  }

  async function regenerarLink(cliente: ClienteConResumen) {
    if (regenerandoId !== null) return;

    // Es destructivo desde el punto de vista del cliente final: el
    // enlace que ya tenía deja de abrir. Por eso se confirma antes.
    const mensaje = t("portal_clientes.confirmar_regenerar").replace("{nombre}", cliente.nombre);
    if (!(await confirmar(mensaje, { peligroso: true }))) return;

    setRegenerandoId(cliente.id);
    try {
      const nuevoToken = await regenerarTokenPortal(cliente.id);

      // Se actualiza en memoria en vez de recargar toda la lista: así
      // el enlace nuevo queda listo para copiar de inmediato.
      setClientes((actuales) =>
        actuales.map((c) => (c.id === cliente.id ? { ...c, token: nuevoToken } : c))
      );
      mostrarToast(t("portal_clientes.msg_link_regenerado"), "exito");
    } catch (error) {
      console.error(error);
      mostrarToast(t("portal_clientes.msg_error_regenerar"), "error");
    } finally {
      setRegenerandoId(null);
    }
  }

  const clientesFiltrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
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
        Icono={UserCircle}
        color="#db2777"
        titulo={t("sidebar.portal_clientes")}
        subtitulo={t("portal_clientes.subtitulo")}
      />

      {loading ? (
        <CargandoLista />
      ) : (
      <>
      <input
        placeholder={t("clientes.buscar")}
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>{t("clientes.nombre")}</th>
              <th>{t("clientes.col_compras")}</th>
              <th>{t("productos.col_acciones")}</th>
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", padding: 30 }}>
                  {t("clientes.sin_clientes")}
                </td>
              </tr>
            ) : (
              clientesFiltrados.map((cliente) => (
                <tr key={cliente.id}>
                  <td>{cliente.nombre}</td>
                  <td>{cliente.compras}</td>
                  <td>
                    <div className="productos-actions">
                      <button
                        className="btn-secondary"
                        style={{ display: "flex", alignItems: "center", gap: 5 }}
                        onClick={() => copiarLink(cliente)}
                      >
                        {copiadoId === cliente.id ? <Check size={13} /> : <Link2 size={13} />}
                        {copiadoId === cliente.id ? t("clientes.link_copiado") : t("clientes.copiar_link_portal")}
                      </button>

                      {cliente.token && (
                        <a
                          href={`/portal-clientes/${cliente.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary"
                          style={{ display: "flex", alignItems: "center", gap: 5, textDecoration: "none" }}
                        >
                          <ExternalLink size={13} /> {t("portal_clientes.ver_portal")}
                        </a>
                      )}

                      {/* Única forma de revocar un enlace que se filtró:
                          el portal no pide contraseña, así que quien
                          tenga el link ve el historial de esta persona. */}
                      {cliente.token && (
                        <button
                          className="btn-secondary"
                          style={{ display: "flex", alignItems: "center", gap: 5 }}
                          disabled={regenerandoId !== null}
                          onClick={() => regenerarLink(cliente)}
                        >
                          <RefreshCw size={13} />
                          {regenerandoId === cliente.id
                            ? t("portal_clientes.regenerando")
                            : t("portal_clientes.regenerar_link")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </>
      )}
    </main>
  );
}
