"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import RequierePlus from "../../components/RequierePlus";
import { cargarDatos } from "../ventas/acciones";
import { formatoFecha, formatoMoneda } from "../ventas/utils";
import { Venta } from "../ventas/types";
import FacturaModal from "../ventas/components/FacturaModal";

function folioDe(id: number) {
  return `F-${String(id).padStart(6, "0")}`;
}

export default function FacturasPage() {
  return (
    <RequierePlus>
      <FacturasContenido />
    </RequierePlus>
  );
}

function FacturasContenido() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [ventaFactura, setVentaFactura] = useState<Venta | null>(null);

  useEffect(() => {
    if (cargandoAuth) return;

    if (!user) {
      router.push("/login");
      return;
    }

    cargarDatos()
      .then((datos) => setVentas(datos.ventas))
      .catch((error) => {
        console.error(error);
        mostrarToast(t("comun.msg_error_cargar_datos"), "error");
      })
      .finally(() => setLoading(false));
  }, [cargandoAuth, user]);

  const texto = busqueda.trim().toLowerCase();

  const filtradas = useMemo(
    () =>
      ventas.filter((v) => {
        if (!texto) return true;

        return (
          v.producto.toLowerCase().includes(texto) ||
          (v.clientes?.nombre ?? "").toLowerCase().includes(texto) ||
          folioDe(v.id).toLowerCase().includes(texto)
        );
      }),
    [ventas, texto]
  );

  if (cargandoAuth || !user) {
    return (
      <main className="fade-up">
        <div className="card">{t("header.cargando")}</div>
      </main>
    );
  }

  return (
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <EncabezadoModulo
        Icono={Receipt}
        color="#f43f5e"
        titulo={t("sidebar.facturas")}
        subtitulo={t("facturas.subtitulo")}
      />

      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder={t("facturas.buscar_placeholder")}
      />

      {loading ? (
        <div className="card">{t("header.cargando")}</div>
      ) : (
      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>{t("facturas.col_folio")}</th>
              <th>{t("tabla.fecha")}</th>
              <th>{t("ventas.cliente")}</th>
              <th>{t("tabla.producto")}</th>
              <th>{t("tabla.cantidad")}</th>
              <th>{t("tabla.total")}</th>
              <th>{t("productos.col_acciones")}</th>
            </tr>
          </thead>

          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  {ventas.length === 0 ? (
                    <>
                      <p style={{ margin: "0 0 12px 0" }}>{t("facturas.sin_facturas")}</p>
                      <Link href="/ventas-rapidas" className="btn-primary" style={{ display: "inline-block" }}>
                        {t("facturas.ir_a_vender")}
                      </Link>
                    </>
                  ) : (
                    <p style={{ margin: 0 }}>{t("facturas.sin_resultados_busqueda")}</p>
                  )}
                </td>
              </tr>
            ) : (
              filtradas.map((venta) => (
                <tr key={venta.id}>
                  <td>{folioDe(venta.id)}</td>
                  <td>{formatoFecha(venta.fecha)}</td>
                  <td>{venta.clientes?.nombre ?? t("ventas.cliente_general")}</td>
                  <td>{venta.producto}</td>
                  <td>{venta.cantidad}</td>
                  <td style={{ fontWeight: 700, color: "var(--primary)" }}>
                    {formatoMoneda(venta.total)}
                  </td>
                  <td>
                    <button
                      className="btn-edit"
                      style={{ display: "flex", alignItems: "center", gap: 5 }}
                      onClick={() => setVentaFactura(venta)}
                    >
                      <Receipt size={13} /> {t("ventas.factura")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      {ventaFactura && (
        <FacturaModal venta={ventaFactura} onClose={() => setVentaFactura(null)} />
      )}
    </main>
  );
}
