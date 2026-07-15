"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCircle, Link2, Check, ExternalLink } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import RequierePlus from "../../components/RequierePlus";
import { copiarAlPortapapeles } from "../../lib/portapapeles";
import { cargarClientes } from "../clientes/acciones";
import { ClienteConResumen } from "../clientes/types";

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

  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<ClienteConResumen[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [copiadoId, setCopiadoId] = useState<number | null>(null);

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

  const clientesFiltrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (cargandoAuth || !user || loading) {
    return (
      <main className="fade-up">
        <div className="card">{t("header.cargando")}</div>
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
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
