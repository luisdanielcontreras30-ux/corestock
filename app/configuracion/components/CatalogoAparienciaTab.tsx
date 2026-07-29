"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { EmpresaConfig, EMPRESA_VACIA } from "../types";
import { cargarEmpresa, guardarEmpresa } from "../acciones";
import { useIdioma } from "../../../components/LanguageProvider";

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
  }, []);

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
    if (!/^#[0-9a-fA-F]{6}$/.test(empresa.color_principal)) {
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
      setMensaje({ tipo: "error", texto: t("empresa.msg_error_guardar") });
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

  const colorValido = /^#[0-9a-fA-F]{6}$/.test(empresa.color_principal);

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
        <div style={{ background: "var(--card-hover)", padding: "14px 16px" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>
            {t("catalogo_apariencia.producto_ejemplo")}
          </p>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: 13,
              fontWeight: 700,
              color: colorValido ? empresa.color_principal : "var(--text-secondary)",
            }}
          >
            $199.00
          </p>
        </div>
      </div>

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
