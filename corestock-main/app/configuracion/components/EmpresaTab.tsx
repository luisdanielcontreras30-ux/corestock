"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, ImagePlus, X } from "lucide-react";
import { EmpresaConfig, EMPRESA_VACIA } from "../types";
import { cargarEmpresa, guardarEmpresa } from "../acciones";
import { supabase } from "../../../lib/supabase";
import { useIdioma } from "../../../components/LanguageProvider";

const MONEDAS = ["MXN", "USD", "EUR", "COP", "ARS", "CLP", "PEN"];
const IDIOMAS = [
  { valor: "es", nombre: "Español" },
  { valor: "en", nombre: "English" },
  { valor: "pt", nombre: "Português" },
  { valor: "fr", nombre: "Français" },
  { valor: "de", nombre: "Deutsch" },
  { valor: "zh", nombre: "中文" },
];
const ZONAS_HORARIAS = [
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Argentina/Buenos_Aires",
  "America/Santiago",
  "Europe/Madrid",
];

export default function EmpresaTab() {
  const { t } = useIdioma();
  const [empresa, setEmpresa] = useState<EmpresaConfig>(EMPRESA_VACIA);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cargarEmpresa()
      .then((datos) => {
        if (datos) setEmpresa(datos);
      })
      .catch((error) => console.error(error))
      .finally(() => setCargando(false));
  }, []);

  function actualizarCampo<K extends keyof EmpresaConfig>(
    campo: K,
    valor: EmpresaConfig[K]
  ) {
    setEmpresa((prev) => ({ ...prev, [campo]: valor }));
  }

  async function alSubirLogo(archivo: File) {
    setSubiendoLogo(true);

    try {
      const nombreArchivo = `logo-${Date.now()}-${archivo.name}`;

      const { error: errorSubida } = await supabase.storage
        .from("productos")
        .upload(nombreArchivo, archivo);

      if (errorSubida) {
        throw errorSubida;
      }

      const { data } = supabase.storage
        .from("productos")
        .getPublicUrl(nombreArchivo);

      actualizarCampo("logo_url", data.publicUrl);
    } catch (error) {
      console.error(error);
      setMensaje({ tipo: "error", texto: t("empresa.msg_error_logo") });
    } finally {
      setSubiendoLogo(false);
    }
  }

  async function alGuardar() {
    setGuardando(true);
    setMensaje(null);

    try {
      await guardarEmpresa(empresa);
      setMensaje({ tipo: "ok", texto: t("empresa.msg_guardado") });
    } catch (error) {
      console.error(error);
      setMensaje({ tipo: "error", texto: t("empresa.msg_error_guardar") });
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return <div className="card">{t("empresa.cargando")}</div>;
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: 6 }}>{t("empresa.titulo")}</h2>
      <p
        style={{
          color: "var(--text-secondary)",
          marginBottom: 20,
          fontSize: 13,
        }}
      >
        {t("empresa.subtitulo")}
      </p>

      <div style={{ marginBottom: 22 }}>
        <label style={{ display: "block", marginBottom: 8 }}>{t("empresa.logotipo")}</label>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 14,
              background: "var(--glass-bg)",
              border: "1px solid var(--border)",
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {empresa.logo_url ? (
              <img
                src={empresa.logo_url}
                alt={t("empresa.logotipo")}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <ImagePlus size={22} color="var(--text-muted)" />
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={subiendoLogo}
                onClick={() => inputArchivoRef.current?.click()}
              >
                {subiendoLogo ? t("empresa.subiendo") : t("empresa.subir_imagen")}
              </button>

              {empresa.logo_url && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => actualizarCampo("logo_url", null)}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <X size={14} /> {t("empresa.quitar")}
                </button>
              )}
            </div>

            <input
              ref={inputArchivoRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) alSubirLogo(archivo);
              }}
            />

            <span style={{ color: "var(--text-muted)", fontSize: 11.5 }}>
              {t("empresa.formato_logo")}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 18,
        }}
      >
        <div>
          <label>{t("empresa.nombre_negocio")}</label>
          <input
            value={empresa.nombre_negocio}
            onChange={(e) =>
              actualizarCampo("nombre_negocio", e.target.value)
            }
            placeholder="Mi Negocio S.A."
          />
        </div>

        <div>
          <label>{t("empresa.direccion")}</label>
          <input
            value={empresa.direccion}
            onChange={(e) => actualizarCampo("direccion", e.target.value)}
            placeholder="Calle, número, ciudad"
          />
        </div>

        <div>
          <label>{t("empresa.telefono")}</label>
          <input
            value={empresa.telefono}
            onChange={(e) => actualizarCampo("telefono", e.target.value)}
            placeholder="+52 xxx xxx xxxx"
          />
        </div>

        <div>
          <label>{t("empresa.correo")}</label>
          <input
            type="email"
            value={empresa.correo}
            onChange={(e) => actualizarCampo("correo", e.target.value)}
            placeholder="contacto@minegocio.com"
          />
        </div>

        <div>
          <label>{t("empresa.rfc")}</label>
          <input
            value={empresa.rfc}
            onChange={(e) => actualizarCampo("rfc", e.target.value)}
            placeholder="Según tu país"
          />
        </div>

        <div>
          <label>{t("empresa.moneda")}</label>
          <select
            value={empresa.moneda}
            onChange={(e) => actualizarCampo("moneda", e.target.value)}
          >
            {MONEDAS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>{t("empresa.zona_horaria")}</label>
          <select
            value={empresa.zona_horaria}
            onChange={(e) =>
              actualizarCampo("zona_horaria", e.target.value)
            }
          >
            {ZONAS_HORARIAS.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>{t("empresa.idioma_negocio")}</label>
          <select
            value={empresa.idioma}
            onChange={(e) => actualizarCampo("idioma", e.target.value)}
          >
            {IDIOMAS.map((i) => (
              <option key={i.valor} value={i.valor}>
                {i.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>{t("empresa.color_principal")}</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="color"
              value={empresa.color_principal}
              onChange={(e) =>
                actualizarCampo("color_principal", e.target.value)
              }
              style={{ width: 46, height: 40, padding: 2, cursor: "pointer" }}
            />
            <input
              value={empresa.color_principal}
              onChange={(e) =>
                actualizarCampo("color_principal", e.target.value)
              }
            />
          </div>
        </div>
      </div>

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
          {mensaje.tipo === "ok" ? (
            <CheckCircle2 size={15} />
          ) : (
            <XCircle size={15} />
          )}
          {mensaje.texto}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button
          className="btn-primary"
          onClick={alGuardar}
          disabled={guardando}
        >
          {guardando ? t("empresa.guardando") : t("empresa.guardar_cambios")}
        </button>
      </div>
    </div>
  );
}
