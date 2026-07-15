"use client";

import { useEffect, useState } from "react";
import { Sparkles, Package, DollarSign, Users, Bell, BookOpen } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useIdioma } from "./LanguageProvider";

const CLAVE_STORAGE_PREFIJO = "corestock_tutorial_visto_";

// Solo se ofrece el tutorial si la cuenta se creó hace poco: evita
// mostrárselo a usuarios que ya llevan tiempo usando la app solo
// porque nunca lo vieron en este navegador/dispositivo.
const VENTANA_CUENTA_NUEVA_MS = 2 * 60 * 60 * 1000;

export default function TutorialInicioModal() {
  const { user } = useAuth();
  const { t } = useIdioma();
  const [visible, setVisible] = useState(false);
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    if (!user) return;

    try {
      const clave = CLAVE_STORAGE_PREFIJO + user.id;
      if (localStorage.getItem(clave)) return;

      const creado = new Date(user.created_at).getTime();
      const esCuentaNueva = !Number.isNaN(creado) && Date.now() - creado < VENTANA_CUENTA_NUEVA_MS;

      if (esCuentaNueva) {
        setVisible(true);
      }
    } catch {
      // localStorage puede fallar (navegación privada, etc.); sin
      // persistencia el tutorial no se vuelve a mostrar en esta
      // sesión una vez cerrado, ver cerrar().
    }
  }, [user]);

  function cerrar() {
    setVisible(false);

    if (!user) return;
    try {
      localStorage.setItem(CLAVE_STORAGE_PREFIJO + user.id, "1");
    } catch {
      // ver comentario en el efecto de arriba
    }
  }

  if (!visible) return null;

  const pasos = [
    { Icono: Sparkles, color: "#5945e4", titulo: t("tutorial_inicio.paso0_titulo"), texto: t("tutorial_inicio.paso0_texto") },
    { Icono: Package, color: "#22c55e", titulo: t("tutorial_inicio.paso1_titulo"), texto: t("tutorial_inicio.paso1_texto") },
    { Icono: DollarSign, color: "#10b981", titulo: t("tutorial_inicio.paso2_titulo"), texto: t("tutorial_inicio.paso2_texto") },
    { Icono: Users, color: "#ec4899", titulo: t("tutorial_inicio.paso3_titulo"), texto: t("tutorial_inicio.paso3_texto") },
    { Icono: Bell, color: "#ef4444", titulo: t("tutorial_inicio.paso4_titulo"), texto: t("tutorial_inicio.paso4_texto") },
    { Icono: BookOpen, color: "#7c3aed", titulo: t("tutorial_inicio.paso5_titulo"), texto: t("tutorial_inicio.paso5_texto") },
  ];

  const actual = pasos[paso];
  const esUltimo = paso === pasos.length - 1;

  return (
    <div className="factura-overlay">
      <div className="card tutorial-inicio-modal fade-up">
        <button className="tutorial-inicio-omitir" onClick={cerrar}>
          {t("tutorial_inicio.omitir")}
        </button>

        <div className="tutorial-inicio-icono" style={{ background: actual.color }}>
          <actual.Icono size={30} color="#fff" />
        </div>

        <h2>{actual.titulo}</h2>
        <p>{actual.texto}</p>

        <div className="tutorial-inicio-puntos">
          {pasos.map((_, i) => (
            <span key={i} className={`tutorial-inicio-punto${i === paso ? " tutorial-inicio-punto-activo" : ""}`} />
          ))}
        </div>

        <div className="tutorial-inicio-botones">
          {paso > 0 && (
            <button className="btn-secondary" onClick={() => setPaso((p) => p - 1)}>
              {t("tutorial_inicio.anterior")}
            </button>
          )}
          <button className="btn-primary" onClick={() => (esUltimo ? cerrar() : setPaso((p) => p + 1))}>
            {esUltimo ? t("tutorial_inicio.empezar") : t("tutorial_inicio.siguiente")}
          </button>
        </div>
      </div>
    </div>
  );
}
