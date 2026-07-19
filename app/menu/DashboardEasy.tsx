"use client";

import Link from "next/link";
import { Zap, DollarSign, Receipt, Inbox, AlertTriangle } from "lucide-react";
import { useIdioma } from "../../components/LanguageProvider";
import { useAuth } from "../../components/AuthProvider";
import { LOCALES } from "../../lib/i18n";
import { formatoMoneda } from "../ventas/utils";
import ContadorAnimado from "../../components/ContadorAnimado";

interface Props {
  ventasHoy: number;
  ticketsHoy: number;
  cajaActual: number;
  productosBajos: number;
}

// text-transform:capitalize pone en mayúscula CADA palabra ("Sábado, 18
// De Julio"); aquí solo se capitaliza la primera letra de la frase.
function capitalizarInicio(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Dashboard de CoreStock Easy: una sola acción protagonista (Vender) y
// cuatro números grandes, tocables, sin gráficas — pensado para
// alguien que solo quiere saber "¿cómo va mi día?" de un vistazo.
export default function DashboardEasy({
  ventasHoy,
  ticketsHoy,
  cajaActual,
  productosBajos,
}: Props) {
  const { t, idioma } = useIdioma();
  const { user } = useAuth();

  return (
    <main className="fade-up dashboard-easy">
      <header className="dashboard-easy-saludo">
        <h1>
          {t("dashboard.saludo")}
          {user?.email ? `, ${user.email.split("@")[0]}` : ""} 👋
        </h1>
        <p suppressHydrationWarning>
          {capitalizarInicio(
            new Date().toLocaleDateString(LOCALES[idioma], {
              weekday: "long",
              day: "numeric",
              month: "long",
            })
          )}
        </p>
      </header>

      <Link href="/ventas-rapidas" className="dashboard-easy-vender">
        <Zap size={26} />
        {t("menu_easy.vender")}
      </Link>

      <div className="dashboard-easy-grid">
        <Link href="/ventas" className="dashboard-easy-tile">
          <span className="dashboard-easy-tile-icono" style={{ background: "#10b981" }}>
            <DollarSign size={22} color="#fff" />
          </span>
          <span className="dashboard-easy-tile-etiqueta">{t("menu_easy.ventas_hoy")}</span>
          <strong>{formatoMoneda(ventasHoy)}</strong>
        </Link>

        <Link href="/ventas" className="dashboard-easy-tile">
          <span className="dashboard-easy-tile-icono" style={{ background: "#3b82f6" }}>
            <Receipt size={22} color="#fff" />
          </span>
          <span className="dashboard-easy-tile-etiqueta">{t("menu_easy.tickets_hoy")}</span>
          <strong><ContadorAnimado valor={ticketsHoy} decimales={0} /></strong>
        </Link>

        <Link href="/caja" className="dashboard-easy-tile">
          <span className="dashboard-easy-tile-icono" style={{ background: "#84cc16" }}>
            <Inbox size={22} color="#fff" />
          </span>
          <span className="dashboard-easy-tile-etiqueta">{t("menu_easy.caja_actual")}</span>
          <strong>{formatoMoneda(cajaActual)}</strong>
        </Link>

        <Link
          href="/alertas"
          className={`dashboard-easy-tile${productosBajos > 0 ? " dashboard-easy-tile-alerta" : ""}`}
        >
          <span className="dashboard-easy-tile-icono" style={{ background: "#ef4444" }}>
            <AlertTriangle size={22} color="#fff" />
          </span>
          <span className="dashboard-easy-tile-etiqueta">{t("menu_easy.productos_bajos")}</span>
          <strong><ContadorAnimado valor={productosBajos} decimales={0} /></strong>
        </Link>
      </div>
    </main>
  );
}
