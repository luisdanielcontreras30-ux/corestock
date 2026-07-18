"use client";

import Link from "next/link";
import {
  Package,
  BarChart3,
  Receipt,
  Palette,
  ShieldCheck,
  Sparkles,
  Target,
  ArrowRightLeft,
  X,
  Check,
  Store,
  Rocket,
} from "lucide-react";
import { useIdioma } from "../../components/LanguageProvider";
import { IDIOMAS_DISPONIBLES, Idioma } from "../../lib/i18n";
import BotonInstalarApp from "../../components/BotonInstalarApp";

export default function BienvenidaPage() {
  const { t, idioma, cambiarIdioma } = useIdioma();

  return (
    <main className="landing">
      <div className="landing-blob landing-blob-1" />
      <div className="landing-blob landing-blob-2" />

      {/* NAV */}
      <nav className="landing-nav fade-up">
        <div className="landing-logo">
          <span className="landing-logo-icon">⬢</span> CoreStock
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <BotonInstalarApp className="landing-nav-cta" />

          <select
            value={idioma}
            onChange={(e) => cambiarIdioma(e.target.value as Idioma)}
            aria-label={t("idioma.titulo")}
            style={{ width: "auto", maxWidth: 150 }}
          >
            {IDIOMAS_DISPONIBLES.map((op) => (
              <option key={op.valor} value={op.valor}>
                {op.bandera} {op.nombre}
              </option>
            ))}
          </select>
        </div>
      </nav>

      {/* HERO */}
      <section className="landing-hero">
        <div className="landing-hero-text fade-up">
          <span className="landing-badge">
            <Sparkles size={13} /> {t("bienvenida.badge_hero")}
          </span>

          <h1>
            {t("bienvenida.hero_titulo_1")}
            <br />
            <span className="landing-gradient-text">
              {t("bienvenida.hero_titulo_2")}
            </span>
          </h1>

          <p>{t("bienvenida.hero_texto")}</p>

          <div className="landing-cta-group">
            <Link href="/login?modo=registro" className="btn-login landing-cta-primary">
              {t("bienvenida.cta_registrarte")}
            </Link>
            <Link href="/login?modo=login" className="landing-cta-secondary">
              {t("bienvenida.cta_ya_tengo_cuenta")}
            </Link>
          </div>
        </div>

        {/* ILUSTRACIÓN PROPIA (SVG) */}
        <div className="landing-illustration fade-up">
          <svg viewBox="0 0 480 420" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="boxGrad1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7c6cff" />
                <stop offset="100%" stopColor="#5945e4" />
              </linearGradient>
              <linearGradient id="boxGrad2" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
              <linearGradient id="shelfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#232a4d" />
                <stop offset="100%" stopColor="#161b33" />
              </linearGradient>
            </defs>

            {/* Estante trasero */}
            <rect x="40" y="60" width="400" height="300" rx="16" fill="url(#shelfGrad)" opacity="0.6" />
            <rect x="40" y="150" width="400" height="6" fill="#2c3560" />
            <rect x="40" y="250" width="400" height="6" fill="#2c3560" />

            {/* Cajas nivel 1 */}
            <rect x="70" y="90" width="70" height="55" rx="8" fill="url(#boxGrad1)" />
            <rect x="160" y="80" width="85" height="65" rx="8" fill="url(#boxGrad2)" />
            <rect x="265" y="95" width="60" height="50" rx="8" fill="#3b82f6" />
            <rect x="340" y="85" width="70" height="60" rx="8" fill="url(#boxGrad1)" />

            {/* Cajas nivel 2 */}
            <rect x="75" y="180" width="65" height="60" rx="8" fill="#10b981" />
            <rect x="155" y="175" width="80" height="65" rx="8" fill="url(#boxGrad2)" />
            <rect x="255" y="185" width="65" height="55" rx="8" fill="url(#boxGrad1)" />
            <rect x="335" y="175" width="75" height="65" rx="8" fill="#3b82f6" opacity="0.85" />

            {/* Cajas nivel 3 */}
            <rect x="70" y="280" width="70" height="55" rx="8" fill="url(#boxGrad2)" />
            <rect x="160" y="270" width="85" height="65" rx="8" fill="#10b981" opacity="0.9" />
            <rect x="265" y="280" width="60" height="55" rx="8" fill="url(#boxGrad1)" />
            <rect x="340" y="275" width="70" height="60" rx="8" fill="url(#boxGrad2)" />

            {/* Flotante: tarjeta de gráfica */}
            <g transform="translate(300, 20)">
              <rect width="150" height="90" rx="14" fill="#121424" stroke="#2c3560" />
              <path d="M14 65 L40 45 L64 55 L90 30 L120 40" stroke="#7c6cff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="120" cy="40" r="5" fill="#7c6cff" />
            </g>

            {/* Flotante: check de stock */}
            <g transform="translate(10, 330)">
              <rect width="120" height="60" rx="14" fill="#121424" stroke="#2c3560" />
              <circle cx="30" cy="30" r="14" fill="#10b981" opacity="0.2" />
              <path d="M23 30 L28 36 L38 22" stroke="#10b981" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="52" y="20" width="55" height="8" rx="4" fill="#2c3560" />
              <rect x="52" y="34" width="35" height="8" rx="4" fill="#2c3560" />
            </g>
          </svg>
        </div>
      </section>

      {/* FEATURES */}
      <section className="landing-features fade-up">
        <div className="landing-feature-card">
          <div className="landing-feature-icon" style={{ background: "#5945e4" }}>
            <Package size={20} color="#fff" />
          </div>
          <h3>{t("bienvenida.feat_inventario_titulo")}</h3>
          <p>{t("bienvenida.feat_inventario_desc")}</p>
        </div>

        <div className="landing-feature-card">
          <div className="landing-feature-icon" style={{ background: "#3b82f6" }}>
            <BarChart3 size={20} color="#fff" />
          </div>
          <h3>{t("bienvenida.feat_graficas_titulo")}</h3>
          <p>{t("bienvenida.feat_graficas_desc")}</p>
        </div>

        <div className="landing-feature-card">
          <div className="landing-feature-icon" style={{ background: "#10b981" }}>
            <Receipt size={20} color="#fff" />
          </div>
          <h3>{t("bienvenida.feat_facturacion_titulo")}</h3>
          <p>{t("bienvenida.feat_facturacion_desc")}</p>
        </div>

        <div className="landing-feature-card">
          <div className="landing-feature-icon" style={{ background: "#ec4899" }}>
            <Palette size={20} color="#fff" />
          </div>
          <h3>{t("bienvenida.feat_temas_titulo")}</h3>
          <p>{t("bienvenida.feat_temas_desc")}</p>
        </div>

        <div className="landing-feature-card">
          <div className="landing-feature-icon" style={{ background: "#f59e0b" }}>
            <ShieldCheck size={20} color="#fff" />
          </div>
          <h3>{t("bienvenida.feat_datos_titulo")}</h3>
          <p>{t("bienvenida.feat_datos_desc")}</p>
        </div>

        <div className="landing-feature-card">
          <div className="landing-feature-icon" style={{ background: "#6366f1" }}>
            <Store size={20} color="#fff" />
          </div>
          <h3>{t("bienvenida.feat_negocio_titulo")}</h3>
          <p>{t("bienvenida.feat_negocio_desc")}</p>
        </div>
      </section>

      {/* CÓMO EMPIEZA */}
      <section className="landing-pasos fade-up">
        <div className="landing-section-header">
          <span className="landing-badge">
            <Rocket size={13} /> {t("bienvenida.badge_empezar")}
          </span>
          <h2>{t("bienvenida.empezar_titulo")}</h2>
        </div>

        <div className="landing-pasos-grid">
          <div className="landing-paso">
            <span className="landing-paso-numero">1</span>
            <h3>{t("bienvenida.paso1_titulo")}</h3>
            <p>{t("bienvenida.paso1_desc")}</p>
          </div>

          <div className="landing-paso">
            <span className="landing-paso-numero">2</span>
            <h3>{t("bienvenida.paso2_titulo")}</h3>
            <p>{t("bienvenida.paso2_desc")}</p>
          </div>

          <div className="landing-paso">
            <span className="landing-paso-numero">3</span>
            <h3>{t("bienvenida.paso3_titulo")}</h3>
            <p>{t("bienvenida.paso3_desc")}</p>
          </div>
        </div>
      </section>

      {/* VISIÓN */}
      <section className="landing-vision fade-up">
        <div className="landing-vision-text">
          <span className="landing-badge">
            <Target size={13} /> {t("bienvenida.badge_vision")}
          </span>

          <h2>
            {t("bienvenida.vision_titulo_1")}
            <br /> {t("bienvenida.vision_titulo_2")}
          </h2>

          <p>{t("bienvenida.vision_texto")}</p>
        </div>
      </section>


      {/* MUESTRA DE GRÁFICAS */}
      <section className="landing-preview fade-up">
        <div className="landing-section-header">
          <span className="landing-badge">
            <BarChart3 size={13} /> {t("bienvenida.badge_preview")}
          </span>
          <h2>{t("bienvenida.preview_titulo")}</h2>
          <p>{t("bienvenida.preview_texto")}</p>
        </div>

        <div className="landing-preview-frame">
          <div className="landing-preview-topbar">
            <span className="landing-preview-dot" style={{ background: "#ef4444" }} />
            <span className="landing-preview-dot" style={{ background: "#f59e0b" }} />
            <span className="landing-preview-dot" style={{ background: "#10b981" }} />
          </div>

          <svg viewBox="0 0 700 340" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto" }}>
            <defs>
              <linearGradient id="barraG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c6cff" />
                <stop offset="100%" stopColor="#5945e4" />
              </linearGradient>
              <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c6cff" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#7c6cff" stopOpacity="0" />
              </linearGradient>
            </defs>

            <rect x="20" y="20" width="150" height="70" rx="10" fill="#161a2e" stroke="#2a3155" />
            <circle cx="42" cy="45" r="10" fill="#7c6cff" />
            <rect x="34" y="62" width="90" height="9" rx="3" fill="#3a4270" />
            <rect x="34" y="76" width="60" height="7" rx="3" fill="#2a3155" />

            <rect x="182" y="20" width="150" height="70" rx="10" fill="#161a2e" stroke="#2a3155" />
            <circle cx="204" cy="45" r="10" fill="#10b981" />
            <rect x="196" y="62" width="90" height="9" rx="3" fill="#3a4270" />
            <rect x="196" y="76" width="60" height="7" rx="3" fill="#2a3155" />

            <rect x="344" y="20" width="150" height="70" rx="10" fill="#161a2e" stroke="#2a3155" />
            <circle cx="366" cy="45" r="10" fill="#3b82f6" />
            <rect x="358" y="62" width="90" height="9" rx="3" fill="#3a4270" />
            <rect x="358" y="76" width="60" height="7" rx="3" fill="#2a3155" />

            <rect x="506" y="20" width="174" height="70" rx="10" fill="#161a2e" stroke="#2a3155" />
            <circle cx="528" cy="45" r="10" fill="#f59e0b" />
            <rect x="520" y="62" width="90" height="9" rx="3" fill="#3a4270" />
            <rect x="520" y="76" width="60" height="7" rx="3" fill="#2a3155" />

            <rect x="20" y="110" width="430" height="210" rx="10" fill="#161a2e" stroke="#2a3155" />
            <path d="M40 260 L100 230 L160 245 L220 190 L280 210 L340 160 L400 180 L430 140 L430 300 L40 300 Z" fill="url(#areaG)" />
            <path d="M40 260 L100 230 L160 245 L220 190 L280 210 L340 160 L400 180 L430 140" fill="none" stroke="#7c6cff" strokeWidth="3" />

            <rect x="466" y="110" width="214" height="210" rx="10" fill="#161a2e" stroke="#2a3155" />
            <rect x="484" y="140" width="178" height="10" rx="4" fill="#3a4270" />
            <rect x="484" y="140" width="120" height="10" rx="4" fill="url(#barraG)" />
            <rect x="484" y="168" width="178" height="10" rx="4" fill="#3a4270" />
            <rect x="484" y="168" width="90" height="10" rx="4" fill="#10b981" />
            <rect x="484" y="196" width="178" height="10" rx="4" fill="#3a4270" />
            <rect x="484" y="196" width="60" height="10" rx="4" fill="#3b82f6" />
            <rect x="484" y="224" width="178" height="10" rx="4" fill="#3a4270" />
            <rect x="484" y="224" width="40" height="10" rx="4" fill="#f59e0b" />
          </svg>
        </div>
      </section>


      <section className="landing-comparativa fade-up">
        <div className="landing-section-header">
          <span className="landing-badge">
            <ArrowRightLeft size={13} /> {t("bienvenida.badge_migracion")}
          </span>
          <h2>{t("bienvenida.migracion_titulo")}</h2>
          <p>{t("bienvenida.migracion_texto")}</p>
        </div>

        <div className="landing-tabla-comparativa">
          <div className="landing-comp-col landing-comp-antes">
            <h3>{t("bienvenida.antes_titulo")}</h3>
            <ul>
              <li><X size={15} /> {t("bienvenida.antes_1")}</li>
              <li><X size={15} /> {t("bienvenida.antes_2")}</li>
              <li><X size={15} /> {t("bienvenida.antes_3")}</li>
              <li><X size={15} /> {t("bienvenida.antes_4")}</li>
              <li><X size={15} /> {t("bienvenida.antes_5")}</li>
              <li><X size={15} /> {t("bienvenida.antes_6")}</li>
              <li><X size={15} /> {t("bienvenida.antes_7")}</li>
            </ul>
          </div>

          <div className="landing-comp-col landing-comp-despues">
            <h3>{t("bienvenida.despues_titulo")}</h3>
            <ul>
              <li><Check size={15} /> {t("bienvenida.despues_1")}</li>
              <li><Check size={15} /> {t("bienvenida.despues_2")}</li>
              <li><Check size={15} /> {t("bienvenida.despues_3")}</li>
              <li><Check size={15} /> {t("bienvenida.despues_4")}</li>
              <li><Check size={15} /> {t("bienvenida.despues_5")}</li>
              <li><Check size={15} /> {t("bienvenida.despues_6")}</li>
              <li><Check size={15} /> {t("bienvenida.despues_7")}</li>
            </ul>
          </div>
        </div>

        <div className="landing-cta-group" style={{ justifyContent: "center", marginTop: 30 }}>
          <Link href="/login?modo=registro" className="btn-login landing-cta-primary">
            {t("bienvenida.cta_cambiarme")}
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <p>© {new Date().getFullYear()} {t("bienvenida.footer")}</p>
      </footer>
    </main>
  );
}
