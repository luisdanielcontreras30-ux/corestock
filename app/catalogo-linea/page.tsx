"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Copy, ExternalLink } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import { ProductoCatalogo } from "./types";
import { cargarEstadoCatalogo, actualizarCatalogoActivo } from "./acciones";

export default function CatalogoLineaPage() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();

  const [loading, setLoading] = useState(true);
  const [activo, setActivo] = useState(false);
  const [empresaConfigurada, setEmpresaConfigurada] = useState(false);
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function obtenerDatos() {
    setLoading(true);
    try {
      const datos = await cargarEstadoCatalogo();
      setActivo(datos.activo);
      setEmpresaConfigurada(datos.empresaConfigurada);
      setProductos(datos.productos);
      setUserId(datos.userId);
    } catch (error) {
      console.error(error);
      alert(t("comun.msg_error_cargar_datos"));
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

  const enlacePublico = userId ? `${window.location.origin}/catalogo/${userId}` : "";

  async function alternar() {
    if (guardando) return;

    try {
      setGuardando(true);
      await actualizarCatalogoActivo(!activo);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : t("catalogo_linea.msg_error_guardar"));
    } finally {
      setGuardando(false);
    }
  }

  async function copiarEnlace() {
    await navigator.clipboard.writeText(enlacePublico);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

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
        Icono={BookOpen}
        color="#7c3aed"
        titulo={t("sidebar.catalogo_linea")}
        subtitulo={t("catalogo_linea.subtitulo")}
      />

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>{t("catalogo_linea.activar")}</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              {t("catalogo_linea.activar_desc")}
            </p>
          </div>

          <button className="btn-primary" onClick={alternar} disabled={guardando || !empresaConfigurada}>
            {activo ? t("catalogo_linea.desactivar") : t("catalogo_linea.activar")}
          </button>
        </div>

        {!empresaConfigurada && (
          <p style={{ color: "#ef4444", fontSize: 13, marginTop: 14 }}>
            {t("catalogo_linea.msg_falta_empresa")}
          </p>
        )}

        {activo && userId && (
          <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input value={enlacePublico} readOnly style={{ flex: 1, minWidth: 240 }} />
            <button className="btn-secondary" onClick={copiarEnlace} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Copy size={14} /> {copiado ? t("catalogo_linea.copiado") : t("catalogo_linea.copiar_enlace")}
            </button>
            <a href={enlacePublico} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ExternalLink size={14} /> {t("catalogo_linea.ver_catalogo")}
            </a>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{t("catalogo_linea.vista_previa")}</h2>

        {productos.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: 13.5 }}>{t("catalogo_linea.sin_productos")}</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
            {productos.map((p) => (
              <div key={p.id} className="card" style={{ padding: 12 }}>
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    borderRadius: 8,
                    background: "var(--bg-secondary)",
                    overflow: "hidden",
                    marginBottom: 8,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {p.imagen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imagen} alt={p.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <BookOpen size={22} color="var(--text-muted)" />
                  )}
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{p.nombre}</p>
                <p style={{ fontSize: 13, color: "var(--primary)", fontWeight: 700, margin: "4px 0 0 0" }}>
                  ${Number(p.precio_venta).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
