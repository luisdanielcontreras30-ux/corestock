"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle, Search, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import { GUIAS } from "./data";

const CATEGORIAS = [
  "sidebar.principal",
  "sidebar.inventario",
  "sidebar.operaciones",
  "sidebar.marketing",
];

export default function TutorialesPage() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();

  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  useEffect(() => {
    if (cargandoAuth) return;
    if (!user) router.push("/login");
  }, [cargandoAuth, user, router]);

  const guiasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return GUIAS.filter((guia) => {
      if (categoria && guia.categoria !== categoria) return false;
      if (!texto) return true;
      return t(guia.tituloClave).toLowerCase().includes(texto);
    });
  }, [busqueda, categoria, t]);

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
        Icono={PlayCircle}
        color="#0891b2"
        titulo={t("sidebar.tutoriales")}
        subtitulo={t("tutoriales.subtitulo")}
      />

      <div style={{ position: "relative", maxWidth: 360 }}>
        <Search
          size={16}
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }}
        />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={t("tutoriales.buscar_placeholder")}
          style={{ paddingLeft: 36, width: "100%" }}
        />
      </div>

      <div className="config-tabs">
        <button
          className={`config-tab ${categoria === null ? "config-tab-active" : ""}`}
          onClick={() => setCategoria(null)}
        >
          {t("tutoriales.todos")}
        </button>
        {CATEGORIAS.map((clave) => (
          <button
            key={clave}
            className={`config-tab ${categoria === clave ? "config-tab-active" : ""}`}
            onClick={() => setCategoria(clave)}
          >
            {t(clave)}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {guiasFiltradas.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
            {t("tutoriales.sin_resultados")}
          </div>
        ) : (
          guiasFiltradas.map((guia) => {
            const abiertaAhora = abierta === guia.id;

            return (
              <div key={guia.id} className="card">
                <button
                  onClick={() => setAbierta(abiertaAhora ? null : guia.id)}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: 17, margin: 0 }}>{t(guia.tituloClave)}</h2>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "4px 0 0 0" }}>
                      {t(guia.descripcionClave)}
                    </p>
                  </div>
                  {abiertaAhora ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {abiertaAhora && (
                  <ol style={{ margin: "16px 0 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                    {guia.pasosClaves.map((pasoClave) => (
                      <li key={pasoClave} style={{ fontSize: 14 }}>
                        {t(pasoClave)}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
