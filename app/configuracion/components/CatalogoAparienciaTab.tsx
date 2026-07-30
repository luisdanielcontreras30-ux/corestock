"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { EmpresaConfig, EMPRESA_VACIA } from "../types";
import { cargarEmpresa, guardarEmpresa } from "../acciones";
import { supabase } from "../../../lib/supabase";
import { useIdioma } from "../../../components/LanguageProvider";
import { contrasteInsuficiente } from "../../../lib/contraste";

const HEX = /^#[0-9a-fA-F]{6}$/;

// Paleta de arranque para las categorías. No se guarda: solo es lo que
// propone el selector la primera vez, para no obligar a nadie a elegir
// un color desde cero para cada categoría.
const COLORES_SUGERIDOS = [
  "#3b82f6",
  "#10b981",
  "#f97316",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
  "#eab308",
  "#ec4899",
];

// El color del catálogo vivía en Configuración → Empresa, entre el RFC y
// la zona horaria. Ahí no lo encontraba nadie: es un ajuste de aspecto,
// no un dato fiscal. Aquí está junto a los temas y las gráficas, que es
// donde alguien busca "cómo se ve mi negocio".
//
// Se carga la configuración COMPLETA antes de guardar (y no solo el
// color) porque guardarEmpresa escribe la fila entera: mandar un objeto
// a medias borraría el nombre, el logo y el resto.
export default function CatalogoAparienciaTab() {
  const { t } = useIdioma();
  const [empresa, setEmpresa] = useState<EmpresaConfig>(EMPRESA_VACIA);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  // Categorías reales del catálogo, para poder pintarlas una por una.
  // Se leen de productos, que es donde viven: no hay tabla de
  // categorías, son texto libre del propio producto.
  const [categorias, setCategorias] = useState<string[]>([]);

  useEffect(() => {
    cargarEmpresa()
      .then((datos) => {
        if (datos) setEmpresa(datos);
      })
      .catch((error) => {
        console.error(error);
        setErrorCarga(true);
      })
      .finally(() => setCargando(false));

    supabase
      .from("productos")
      .select("categoria")
      .eq("activo", true)
      .then(({ data, error }) => {
        if (error) {
          // Sin categorías la pantalla sigue sirviendo para todo lo
          // demás; no vale la pena bloquearla por esto.
          console.error(error);
          return;
        }
        const vistas = new Set<string>();
        for (const fila of data ?? []) {
          const c = (fila as { categoria?: string | null }).categoria?.trim();
          if (c) vistas.add(c);
        }
        setCategorias([...vistas].sort((a, b) => a.localeCompare(b)));
      });
  }, []);

  function cambiarCampo(campo: keyof EmpresaConfig, valor: string) {
    setEmpresa((prev) => ({ ...prev, [campo]: valor }));
    setMensaje(null);
  }

  // El color GUARDADO de una categoría, o null si no tiene. La
  // distinción importa: el catálogo público solo pinta las categorías
  // que de verdad tienen color, así que enseñar aquí un círculo de
  // color para todas —como hacía antes, con la paleta de sugerencias—
  // prometía algo que el catálogo no cumplía.
  function colorGuardado(nombre: string): string | null {
    const valor = empresa.catalogo_colores_categoria?.[nombre];
    return valor && HEX.test(valor) ? valor : null;
  }

  function sugerenciaPara(indice: number): string {
    return COLORES_SUGERIDOS[indice % COLORES_SUGERIDOS.length];
  }

  function cambiarColorCategoria(nombre: string, valor: string) {
    setEmpresa((prev) => ({
      ...prev,
      catalogo_colores_categoria: { ...(prev.catalogo_colores_categoria ?? {}), [nombre]: valor },
    }));
    setMensaje(null);
  }

  function quitarColorCategoria(nombre: string) {
    setEmpresa((prev) => {
      // Se BORRA la clave en vez de dejarla vacía: una cadena vacía
      // guardada en el JSON no es un color, y tendría que filtrarse en
      // cada lectura para siempre.
      const resto = { ...(prev.catalogo_colores_categoria ?? {}) };
      delete resto[nombre];
      return { ...prev, catalogo_colores_categoria: resto };
    });
    setMensaje(null);
  }

  function cambiarColor(valor: string) {
    setEmpresa((prev) => ({ ...prev, color_principal: valor }));
    setMensaje(null);
  }

  async function alGuardar() {
    if (guardando) return;

    // El selector de color siempre manda un hex válido, pero el campo de
    // texto de al lado es libre — un valor inválido se usaría tal cual
    // como color de fondo del catálogo público, donde el navegador lo
    // ignora sin avisarle a nadie.
    const aValidar = [
      empresa.color_principal,
      empresa.catalogo_color_fondo,
      empresa.catalogo_color_producto,
      empresa.catalogo_color_borde,
      empresa.catalogo_color_titulo,
      empresa.catalogo_color_precio,
      empresa.catalogo_color_boton,
      ...Object.values(empresa.catalogo_colores_categoria ?? {}),
    ];

    if (aValidar.some((c) => c && !HEX.test(c))) {
      setMensaje({ tipo: "error", texto: t("empresa.msg_color_invalido") });
      return;
    }

    setGuardando(true);
    setMensaje(null);

    try {
      await guardarEmpresa(empresa);
      setMensaje({ tipo: "ok", texto: t("empresa.msg_guardado") });
    } catch (error) {
      console.error(error);
      // Si faltan las columnas nuevas, decirlo: la solución es correr un
      // archivo, no reintentar.
      const texto = error instanceof Error ? error.message : "";
      const faltaMigracion = /column .* does not exist|catalogo_color|colores_categoria/i.test(texto);
      setMensaje({
        tipo: "error",
        texto: t(faltaMigracion ? "catalogo_apariencia.falta_migracion" : "empresa.msg_error_guardar"),
      });
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return <div className="card">{t("empresa.cargando")}</div>;
  }

  if (errorCarga) {
    return (
      <div className="card">
        <p style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: 6 }}>
          <XCircle size={16} /> {t("empresa.msg_error_cargar")}
        </p>
      </div>
    );
  }

  const colorValido = HEX.test(empresa.color_principal);
  const colorFondo = empresa.catalogo_color_fondo || "";
  const colorProducto = empresa.catalogo_color_producto || "";
  const colorBorde = empresa.catalogo_color_borde || "";
  const colorTitulo = empresa.catalogo_color_titulo || "";
  const colorPrecio = empresa.catalogo_color_precio || empresa.color_principal;
  const colorBoton = empresa.catalogo_color_boton || empresa.color_principal;

  // Fondo real contra el que se lee el texto de una tarjeta: el de la
  // tarjeta si está definido, y si no el de la página.
  const fondoDelTexto = HEX.test(colorProducto)
    ? colorProducto
    : HEX.test(colorFondo)
      ? colorFondo
      : "";

  // Solo se comparan combinaciones que la persona eligió de verdad. Con
  // los valores por defecto no hay nada que avisar: los del tema ya
  // contrastan entre sí.
  const avisosContraste: string[] = [];
  if (fondoDelTexto) {
    if (HEX.test(colorTitulo) && contrasteInsuficiente(colorTitulo, fondoDelTexto)) {
      avisosContraste.push(t("catalogo_apariencia.color_titulo"));
    }
    if (HEX.test(colorPrecio) && contrasteInsuficiente(colorPrecio, fondoDelTexto)) {
      avisosContraste.push(t("catalogo_apariencia.color_precio"));
    }
  }
  // El texto de los botones es blanco, así que un botón claro se queda
  // sin etiqueta legible.
  if (HEX.test(colorBoton) && contrasteInsuficiente("#ffffff", colorBoton)) {
    avisosContraste.push(t("catalogo_apariencia.color_boton"));
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: 6 }}>{t("catalogo_apariencia.titulo")}</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: 20, fontSize: 13, lineHeight: 1.6 }}>
        {t("catalogo_apariencia.subtitulo")}
      </p>

      <label>{t("empresa.color_principal")}</label>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}>
        <input
          type="color"
          value={colorValido ? empresa.color_principal : "#5945e4"}
          onChange={(e) => cambiarColor(e.target.value)}
          style={{ width: 46, height: 40, padding: 2, cursor: "pointer" }}
        />
        <input value={empresa.color_principal} onChange={(e) => cambiarColor(e.target.value)} />
      </div>

      {/* Ver el color aplicado de verdad evita el viaje de guardar, abrir
          el catálogo en otra pestaña y volver a corregir. */}
      <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
        {t("catalogo_apariencia.vista_previa")}
      </p>
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
          overflow: "hidden",
          marginBottom: 20,
          maxWidth: 340,
          background: HEX.test(colorFondo) ? colorFondo : undefined,
        }}
      >
        <div
          style={{
            background: colorValido ? empresa.color_principal : "var(--card-hover)",
            padding: "20px 16px",
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {empresa.nombre_negocio || t("catalogo_apariencia.negocio_ejemplo")}
        </div>
        <div
          style={{
            background: HEX.test(colorProducto) ? colorProducto : "var(--card-hover)",
            border: HEX.test(colorBorde) ? `1px solid ${colorBorde}` : undefined,
            padding: "14px 16px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: HEX.test(colorTitulo) ? colorTitulo : "var(--text-primary)",
              fontWeight: 600,
            }}
          >
            {t("catalogo_apariencia.producto_ejemplo")}
          </p>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: 13,
              fontWeight: 700,
              color: HEX.test(colorPrecio) ? colorPrecio : "var(--text-secondary)",
            }}
          >
            $199.00
          </p>
          <span
            style={{
              display: "inline-block",
              marginTop: 10,
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: "#fff",
              background: HEX.test(colorBoton) ? colorBoton : "#5945e4",
            }}
          >
            {t("catalogo_apariencia.boton_ejemplo")}
          </span>
        </div>
      </div>

      {/* Colores de la tarjeta de producto. Vacíos = como está hoy: no
          se inventa ningún valor por defecto que cambie el catálogo de
          alguien sin que lo haya pedido. */}
      <h3 className="cat-apariencia-titulo">{t("catalogo_apariencia.producto_titulo")}</h3>
      <div className="cat-apariencia-colores">
        <ColorOpcional
          etiqueta={t("catalogo_apariencia.color_fondo_pagina")}
          valor={colorFondo}
          alCambiar={(v) => cambiarCampo("catalogo_color_fondo", v)}
          porDefecto="#090a14"
        />
        <ColorOpcional
          etiqueta={t("catalogo_apariencia.color_fondo")}
          valor={colorProducto}
          alCambiar={(v) => cambiarCampo("catalogo_color_producto", v)}
          porDefecto="#151827"
        />
        <ColorOpcional
          etiqueta={t("catalogo_apariencia.color_borde")}
          valor={colorBorde}
          alCambiar={(v) => cambiarCampo("catalogo_color_borde", v)}
          porDefecto="#2a2e42"
        />
        <ColorOpcional
          etiqueta={t("catalogo_apariencia.color_titulo")}
          valor={colorTitulo}
          alCambiar={(v) => cambiarCampo("catalogo_color_titulo", v)}
          porDefecto="#ffffff"
        />
        <ColorOpcional
          etiqueta={t("catalogo_apariencia.color_precio")}
          valor={empresa.catalogo_color_precio || ""}
          alCambiar={(v) => cambiarCampo("catalogo_color_precio", v)}
          porDefecto={colorValido ? empresa.color_principal : "#5945e4"}
        />
        <ColorOpcional
          etiqueta={t("catalogo_apariencia.color_boton")}
          valor={empresa.catalogo_color_boton || ""}
          alCambiar={(v) => cambiarCampo("catalogo_color_boton", v)}
          porDefecto={colorValido ? empresa.color_principal : "#5945e4"}
        />
      </div>

      {categorias.length > 0 && (
        <>
          <h3 className="cat-apariencia-titulo">{t("catalogo_apariencia.categorias_titulo")}</h3>
          <p className="cat-apariencia-ayuda">{t("catalogo_apariencia.categorias_ayuda")}</p>
          <div className="cat-apariencia-categorias">
            {categorias.map((c, i) => {
              const asignado = colorGuardado(c);

              // Sin color asignado no se dibuja un selector con un color
              // dentro: se ofrece asignarlo. Un toque pone la sugerencia
              // y desde ahí ya se puede afinar.
              if (!asignado) {
                return (
                  <button
                    key={c}
                    type="button"
                    className="cat-apariencia-categoria cat-apariencia-categoria-vacia"
                    onClick={() => cambiarColorCategoria(c, sugerenciaPara(i))}
                  >
                    <span className="cat-apariencia-punto-vacio" aria-hidden="true" />
                    <span>{c}</span>
                    <span className="cat-apariencia-asignar">
                      {t("catalogo_apariencia.asignar_color")}
                    </span>
                  </button>
                );
              }

              return (
                <span key={c} className="cat-apariencia-categoria">
                  <input
                    type="color"
                    value={asignado}
                    onChange={(e) => cambiarColorCategoria(c, e.target.value)}
                    aria-label={c}
                  />
                  <span>{c}</span>
                  <button
                    type="button"
                    className="cat-apariencia-quitar"
                    onClick={() => quitarColorCategoria(c)}
                    aria-label={t("catalogo_apariencia.quitar_color")}
                    title={t("catalogo_apariencia.quitar_color")}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        </>
      )}

      {/* No bloquea el guardado: es una elección de diseño de quien
          manda, y puede haber razones. Pero quien lo sufre es el cliente
          que abre el catálogo en su teléfono, no quien lo configuró, así
          que al menos se dice. */}
      {avisosContraste.length > 0 && (
        <div className="cat-apariencia-aviso">
          <AlertTriangle size={16} />
          <p>
            {t("catalogo_apariencia.aviso_contraste").replace(
              "{campos}",
              avisosContraste.join(", ")
            )}
          </p>
        </div>
      )}

      <button className="btn-primary" onClick={alGuardar} disabled={guardando}>
        {guardando ? t("empresa.guardando") : t("empresa.guardar_cambios")}
      </button>

      {mensaje && (
        <p
          style={{
            marginTop: 16,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: mensaje.tipo === "ok" ? "#10b981" : "#ef4444",
          }}
        >
          {mensaje.tipo === "ok" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}

// Un color que puede estar SIN definir. El <input type="color"> no
// admite vacío —siempre devuelve un hex— así que sin este envoltorio no
// habría forma de decir "déjalo como está" una vez tocado el selector.
function ColorOpcional({
  etiqueta,
  valor,
  alCambiar,
  porDefecto,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  porDefecto: string;
}) {
  const activo = HEX.test(valor);

  return (
    <div className="cat-apariencia-color">
      <label>{etiqueta}</label>
      <div className="cat-apariencia-color-fila">
        <input
          type="color"
          value={activo ? valor : porDefecto}
          onChange={(e) => alCambiar(e.target.value)}
        />
        <input value={valor} onChange={(e) => alCambiar(e.target.value)} placeholder={porDefecto} />
        {activo && (
          <button type="button" className="btn-secondary" onClick={() => alCambiar("")}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}
