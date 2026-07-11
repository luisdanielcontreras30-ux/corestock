"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useIdioma } from "../../components/LanguageProvider";
import { useAuth } from "../../components/AuthProvider";
import ConfigTabs from "./components/ConfigTabs";
import ApariciarenciaTab from "./components/ApariciarenciaTab";
import EmpresaTab from "./components/EmpresaTab";
import UsuariosTab from "./components/UsuariosTab";
import CuentaTab from "./components/CuentaTab";
import IdiomaTab from "./components/IdiomaTab";

export default function ConfiguracionPage() {
  const [tab, setTab] = useState("apariencia");
  const { t } = useIdioma();
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();

  useEffect(() => {
    if (cargandoAuth) return;
    if (!user) router.push("/login");
  }, [cargandoAuth, user, router]);

  if (cargandoAuth || !user) {
    return (
      <main className="fade-up">
        <div className="card">{t("header.cargando")}</div>
      </main>
    );
  }

  return (
    <main
      className="fade-up"
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      <div>
        <h1 style={{ fontSize: 34, fontWeight: 700 }}>{t("config.titulo")}</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          {t("config.subtitulo")}
        </p>
      </div>

      <ConfigTabs activa={tab} onCambiar={setTab} />

      {tab === "apariencia" && <ApariciarenciaTab />}
      {tab === "empresa" && <EmpresaTab />}
      {tab === "usuarios" && <UsuariosTab />}
      {tab === "cuenta" && <CuentaTab />}
      {tab === "idioma" && <IdiomaTab />}
    </main>
  );
}
