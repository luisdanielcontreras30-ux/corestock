"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserCircle, Link2, ArrowRight } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";

export default function PortalClientesPage() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();

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
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 34, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
          <UserCircle size={28} /> {t("sidebar.portal_clientes")}
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>{t("portal_clientes.subtitulo")}</p>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "rgba(89,69,228,0.12)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Link2 size={20} color="var(--primary)" />
          </div>
          <div>
            <h2 style={{ marginBottom: 6 }}>{t("portal_clientes.como_funciona")}</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13.5, lineHeight: 1.6 }}>
              {t("portal_clientes.como_funciona_desc")}
            </p>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <a href="/clientes" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            {t("portal_clientes.ir_a_clientes")} <ArrowRight size={15} />
          </a>
        </div>
      </div>
    </main>
  );
}
