"use client";

import { use, useEffect, useState } from "react";
import { UserCircle, PackageX } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";
import { obtenerPortalCliente, CompraPortal } from "./acciones";

interface Props {
  params: Promise<{ token: string }>;
}

// Con separador de miles — sin importar formatoMoneda() de ventas/utils
// para no meter xlsx (usado solo por exportarExcel) en el bundle de esta
// página pública.
function precioFormato(valor: number) {
  return valor.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PortalClientePage({ params }: Props) {
  const { token } = use(params);
  const { t } = useIdioma();

  const [loading, setLoading] = useState(true);
  const [encontrado, setEncontrado] = useState(false);
  const [clienteNombre, setClienteNombre] = useState("");
  const [compras, setCompras] = useState<CompraPortal[]>([]);

  useEffect(() => {
    obtenerPortalCliente(token)
      .then((datos) => {
        if (datos.encontrado) {
          setEncontrado(true);
          setClienteNombre(datos.clienteNombre);
          setCompras(datos.compras);
        }
      })
      .catch((error) => console.error(error))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p style={{ color: "var(--text-secondary)" }}>{t("header.cargando")}</p>
      </div>
    );
  }

  if (!encontrado) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div>
          <PackageX size={40} style={{ marginBottom: 12, color: "var(--text-muted)" }} />
          <h1 style={{ fontSize: 22, marginBottom: 6 }}>{t("portal_publico.no_disponible")}</h1>
          <p style={{ color: "var(--text-secondary)" }}>{t("portal_publico.no_disponible_desc")}</p>
        </div>
      </div>
    );
  }

  const totalGastado = compras.reduce((sum, c) => sum + Number(c.total), 0);

  return (
    <div style={{ minHeight: "100vh", padding: "32px 20px", maxWidth: 720, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "var(--primary)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <UserCircle size={26} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{clienteNombre}</h1>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 13.5 }}>{t("portal_publico.subtitulo")}</p>
        </div>
      </header>

      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, textTransform: "uppercase", margin: 0 }}>
          {t("portal_publico.total_gastado")}
        </p>
        <h2 style={{ fontSize: 28, margin: "6px 0 0 0", color: "var(--primary)" }}>${precioFormato(totalGastado)}</h2>
      </div>

      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>{t("tabla.fecha")}</th>
              <th>{t("tabla.producto")}</th>
              <th>{t("tabla.cantidad")}</th>
              <th>{t("tabla.total")}</th>
            </tr>
          </thead>
          <tbody>
            {compras.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  {t("portal_publico.sin_compras")}
                </td>
              </tr>
            ) : (
              compras.map((c) => (
                <tr key={c.id}>
                  <td>{new Date(c.fecha).toLocaleDateString()}</td>
                  <td>{c.producto}</td>
                  <td>{c.cantidad}</td>
                  <td style={{ fontWeight: 700 }}>${precioFormato(Number(c.total))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
