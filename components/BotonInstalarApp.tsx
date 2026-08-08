"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useIdioma } from "./LanguageProvider";

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Botón para instalar CoreStock como PWA. Solo se muestra cuando el
// navegador realmente tiene el prompt nativo de instalación listo
// (Chrome/Edge/Android) — nada de modal con instrucciones como
// alternativa: si el navegador no lo soporta (iOS Safari) o el
// evento todavía no llegó, el botón simplemente no aparece.
export default function BotonInstalarApp({ className }: { className?: string }) {
  const { t } = useIdioma();
  const [eventoDiferido, setEventoDiferido] = useState<EventoInstalacion | null>(null);
  const [instalada, setInstalada] = useState(false);

  useEffect(() => {
    const enStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalada(enStandalone);

    function alDisponible(e: Event) {
      e.preventDefault();
      setEventoDiferido(e as EventoInstalacion);
    }

    function alInstalar() {
      setInstalada(true);
      setEventoDiferido(null);
    }

    window.addEventListener("beforeinstallprompt", alDisponible);
    window.addEventListener("appinstalled", alInstalar);

    return () => {
      window.removeEventListener("beforeinstallprompt", alDisponible);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  async function alHacerClic() {
    if (!eventoDiferido) return;

    await eventoDiferido.prompt();
    const eleccion = await eventoDiferido.userChoice;
    if (eleccion.outcome === "accepted") {
      setEventoDiferido(null);
    }
  }

  if (instalada || !eventoDiferido) return null;

  return (
    <button
      type="button"
      className={className ?? "landing-nav-cta"}
      style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
      onClick={alHacerClic}
    >
      <Download size={14} />
      <span className="boton-instalar-app-texto">{t("bienvenida.descargar_app")}</span>
    </button>
  );
}
