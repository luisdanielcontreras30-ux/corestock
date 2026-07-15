"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Store, PackageX, ChevronDown, MessageCircle, FileText, X } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";
import { obtenerCatalogoPublico, ProductoPublico } from "./acciones";

interface Props {
  params: Promise<{ userId: string }>;
}

interface Categoria {
  nombre: string;
  productos: ProductoPublico[];
}

function limpiarTelefono(telefono: string) {
  return telefono.replace(/[^\d]/g, "");
}

function enlaceWhatsApp(telefono: string, mensaje: string) {
  const numero = limpiarTelefono(telefono);
  return `https://api.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(mensaje)}`;
}

export default function CatalogoPublicoPage({ params }: Props) {
  const { userId } = use(params);
  const { t } = useIdioma();

  const [loading, setLoading] = useState(true);
  const [encontrado, setEncontrado] = useState(false);
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [colorPrincipal, setColorPrincipal] = useState("#5945e4");
  const [telefono, setTelefono] = useState<string | null>(null);
  const [productos, setProductos] = useState<ProductoPublico[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoPublico | null>(null);

  useEffect(() => {
    obtenerCatalogoPublico(userId)
      .then((datos) => {
        if (datos.encontrado) {
          setEncontrado(true);
          setNombreNegocio(datos.nombreNegocio);
          setLogoUrl(datos.logoUrl);
          setColorPrincipal(datos.colorPrincipal);
          setTelefono(datos.telefono);
          setProductos(datos.productos);
        }
      })
      .catch((error) => console.error(error))
      .finally(() => setLoading(false));
  }, [userId]);

  // Agrupa preservando el orden en que ya vienen (por categoría, luego
  // nombre) para no tener que volver a ordenar aquí.
  const categorias = useMemo<Categoria[]>(() => {
    const mapa = new Map<string, ProductoPublico[]>();

    for (const p of productos) {
      const clave = p.categoria || t("catalogo_publico.sin_categoria");
      const lista = mapa.get(clave) ?? [];
      lista.push(p);
      mapa.set(clave, lista);
    }

    return Array.from(mapa.entries()).map(([nombre, productos]) => ({ nombre, productos }));
  }, [productos, t]);

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        <p style={{ color: "var(--text-secondary)" }}>{t("header.cargando")}</p>
      </div>
    );
  }

  if (!encontrado) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div>
          <PackageX size={40} style={{ marginBottom: 12, color: "var(--text-muted)" }} />
          <h1 style={{ fontSize: 22, marginBottom: 6 }}>{t("catalogo_publico.no_disponible")}</h1>
          <p style={{ color: "var(--text-secondary)" }}>{t("catalogo_publico.no_disponible_desc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="catalogo-publico-scroll">
      <header className="catalogo-publico-header">
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
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
            <Store size={22} color="#fff" />
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {nombreNegocio}
          </h1>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 12 }}>{t("catalogo_publico.subtitulo")}</p>
        </div>
      </header>

      {categorias.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 40 }}>
          {t("catalogo_publico.sin_productos")}
        </p>
      ) : (
        categorias.map((cat, i) => (
          <section key={cat.nombre} className="catalogo-publico-categoria">
            <div className="catalogo-publico-categoria-titulo">
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{cat.nombre}</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 12.5, margin: "4px 0 0 0" }}>
                {t("catalogo_publico.desliza_productos")}
              </p>
            </div>

            <div className="catalogo-publico-productos-fila">
              {cat.productos.map((p) => (
                <div
                  key={p.id}
                  className="card catalogo-publico-producto"
                  onClick={() => setProductoSeleccionado(p)}
                >
                  <div className="catalogo-publico-producto-imagen">
                    {p.imagen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imagen} alt={p.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <Store size={28} color="var(--text-muted)" />
                    )}
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{p.nombre}</p>
                  <p style={{ fontSize: 15, color: colorPrincipal, fontWeight: 700, margin: "6px 0 0 0" }}>
                    ${Number(p.precio).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            {i < categorias.length - 1 && (
              <div className="catalogo-publico-siguiente">
                <ChevronDown size={18} />
                <span>{t("catalogo_publico.desliza_categorias")}</span>
              </div>
            )}
          </section>
        ))
      )}

      {productoSeleccionado && (
        <div
          className="catalogo-publico-overlay"
          onClick={() => setProductoSeleccionado(null)}
        >
          <div className="catalogo-publico-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="catalogo-publico-sheet-header">
              <p>{productoSeleccionado.nombre}</p>
              <button onClick={() => setProductoSeleccionado(null)} aria-label={t("factura.cerrar")}>
                <X size={16} />
              </button>
            </div>

            {telefono ? (
              <>
                <a
                  className="catalogo-publico-sheet-opcion"
                  href={enlaceWhatsApp(
                    telefono,
                    t("catalogo_publico.msg_cotizar")
                      .replace("{producto}", productoSeleccionado.nombre)
                      .replace("{precio}", Number(productoSeleccionado.precio).toFixed(2))
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="catalogo-publico-sheet-opcion-icono" style={{ background: colorPrincipal }}>
                    <FileText size={20} color="#fff" />
                  </span>
                  {t("catalogo_publico.realizar_cotizacion")}
                </a>

                <a
                  className="catalogo-publico-sheet-opcion"
                  href={enlaceWhatsApp(
                    telefono,
                    t("catalogo_publico.msg_contactar").replace("{producto}", productoSeleccionado.nombre)
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="catalogo-publico-sheet-opcion-icono" style={{ background: "#25d366" }}>
                    <MessageCircle size={20} color="#fff" />
                  </span>
                  {t("catalogo_publico.comunicarme_whatsapp")}
                </a>
              </>
            ) : (
              <p style={{ color: "var(--text-secondary)", fontSize: 13.5, padding: "8px 0" }}>
                {t("catalogo_publico.sin_contacto")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
