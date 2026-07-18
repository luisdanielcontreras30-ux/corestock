"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useIdioma } from "./LanguageProvider";

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Botón para instalar CoreStock como PWA. En Chrome/Edge/Android
// dispara el prompt nativo de instalación; en iOS (que no soporta ese
// prompt) y en navegadores donde el evento todavía no llegó, muestra
// instrucciones cortas en vez de desaparecer sin más.
export default function BotonInstalarApp({ className }: { className?: string }) {
  const { t } = useIdioma();
  const [eventoDiferido, setEventoDiferido] = useState<EventoInstalacion | null>(null);
  const [instalada, setInstalada] = useState(false);
  const [esIOS, setEsIOS] = useState(false);
  const [mostrarInstrucciones, setMostrarInstrucciones] = useState(false);

  useEffect(() => {
    const enStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalada(enStandalone);
    setEsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

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
    if (eventoDiferido) {
      await eventoDiferido.prompt();
      const eleccion = await eventoDiferido.userChoice;
      if (eleccion.outcome === "accepted") {
        setEventoDiferido(null);
      }
      return;
    }

    setMostrarInstrucciones(true);
  }

  if (instalada) return null;

  return (
    <>
      <button
        type="button"
        className={className ?? "landing-nav-cta"}
        style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
        onClick={alHacerClic}
      >
        <Download size={14} />
        <span className="boton-instalar-app-texto">{t("bienvenida.descargar_app")}</span>
      </button>

      {mostrarInstrucciones && (
        <div className="factura-overlay" onClick={() => setMostrarInstrucciones(false)}>
          <div
            className="card fade-up"
            style={{ width: "100%", maxWidth: 380 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 12 }}>{t("bienvenida.instalar_titulo")}</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 13.5, marginBottom: 10 }}>
              {t("bienvenida.instalar_texto")}
            </p>
            {esIOS && (
              <p style={{ color: "var(--text-secondary)", fontSize: 13.5, marginBottom: 16 }}>
                {t("bienvenida.instalar_ios_texto")}
              </p>
            )}
            <button className="btn-primary" onClick={() => setMostrarInstrucciones(false)}>
              {t("bienvenida.instalar_entendido")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
