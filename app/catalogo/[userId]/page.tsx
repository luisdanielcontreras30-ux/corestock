"use client";

import { use, useEffect, useState } from "react";
import { Store, PackageX } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";
import { obtenerCatalogoPublico, ProductoPublico } from "./acciones";

interface Props {
  params: Promise<{ userId: string }>;
}

export default function CatalogoPublicoPage({ params }: Props) {
  const { userId } = use(params);
  const { t } = useIdioma();

  const [loading, setLoading] = useState(true);
  const [encontrado, setEncontrado] = useState(false);
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [colorPrincipal, setColorPrincipal] = useState("#5945e4");
  const [productos, setProductos] = useState<ProductoPublico[]>([]);

  useEffect(() => {
    obtenerCatalogoPublico(userId)
      .then((datos) => {
        if (datos.encontrado) {
          setEncontrado(true);
          setNombreNegocio(datos.nombreNegocio);
          setLogoUrl(datos.logoUrl);
          setColorPrincipal(datos.colorPrincipal);
          setProductos(datos.productos);
        }
      })
      .catch((error) => console.error(error))
      .finally(() => setLoading(false));
  }, [userId]);

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
          <h1 style={{ fontSize: 22, marginBottom: 6 }}>{t("catalogo_publico.no_disponible")}</h1>
          <p style={{ color: "var(--text-secondary)" }}>{t("catalogo_publico.no_disponible_desc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "32px 20px", maxWidth: 960, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: colorPrincipal,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={nombreNegocio} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Store size={26} color="#fff" />
          )}
        </div>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>{nombreNegocio}</h1>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 13.5 }}>{t("catalogo_publico.subtitulo")}</p>
        </div>
      </header>

      {productos.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 40 }}>
          {t("catalogo_publico.sin_productos")}
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 18 }}>
          {productos.map((p) => (
            <div key={p.id} className="card" style={{ padding: 14 }}>
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  borderRadius: 10,
                  background: "var(--bg-secondary)",
                  overflow: "hidden",
                  marginBottom: 10,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {p.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagen} alt={p.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <Store size={24} color="var(--text-muted)" />
                )}
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{p.nombre}</p>
              <p style={{ fontSize: 15, color: colorPrincipal, fontWeight: 700, margin: "6px 0 0 0" }}>
                ${Number(p.precio).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
