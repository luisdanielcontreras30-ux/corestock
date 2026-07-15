"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { useIdioma } from "../../components/LanguageProvider";
import { useAuth } from "../../components/AuthProvider";
import { useMiembroActivo } from "../../components/MiembroActivoProvider";
import SinPermiso from "../../components/SinPermiso";
import EncabezadoModulo from "../../components/EncabezadoModulo";
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
  const { puede } = useMiembroActivo();

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
      <EncabezadoModulo
        Icono={Settings}
        color="#64748b"
        titulo={t("config.titulo")}
        subtitulo={t("config.subtitulo")}
      />

      <ConfigTabs activa={tab} onCambiar={setTab} />

      {tab === "apariencia" && <ApariciarenciaTab />}
      {tab === "empresa" && (puede("configuracion") ? <EmpresaTab /> : <SinPermiso />)}
      {tab === "usuarios" && (puede("configuracion") ? <UsuariosTab /> : <SinPermiso />)}
      {tab === "cuenta" && <CuentaTab />}
      {tab === "idioma" && <IdiomaTab />}
    </main>
  );
}
