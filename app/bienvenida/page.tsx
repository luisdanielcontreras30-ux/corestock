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

export default function BienvenidaPage() {
  return (
    <main className="landing">
      <div className="landing-blob landing-blob-1" />
      <div className="landing-blob landing-blob-2" />

      {/* NAV */}
      <nav className="landing-nav fade-up">
        <div className="landing-logo">
          <span className="landing-logo-icon">⬢</span> CoreStock
        </div>
      </nav>

      {/* HERO */}
      <section className="landing-hero">
        <div className="landing-hero-text fade-up">
          <span className="landing-badge">
            <Sparkles size={13} /> Inventario inteligente
          </span>

          <h1>
            El control de tu inventario,
            <br />
            <span className="landing-gradient-text">
              hecho para crecer contigo
            </span>
          </h1>

          <p>
            CoreStock centraliza tus productos, tus ventas y tu
            facturación en un solo lugar — con estadísticas en tiempo
            real que te ayudan a decidir mejor, más rápido.
          </p>

          <div className="landing-cta-group">
            <Link href="/login?modo=registro" className="btn-login landing-cta-primary">
              Registrarte
            </Link>
            <Link href="/login?modo=login" className="landing-cta-secondary">
              Ya tengo cuenta
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
          <h3>Inventario con imágenes</h3>
          <p>
            Sube una foto de cada producto y arma un catálogo que se
            reconoce de un vistazo. Registra precio, stock y categoría,
            y edítalos cuando quieras — todo desde una sola pantalla.
          </p>
        </div>

        <div className="landing-feature-card">
          <div className="landing-feature-icon" style={{ background: "#3b82f6" }}>
            <BarChart3 size={20} color="#fff" />
          </div>
          <h3>Gráficas en tiempo real</h3>
          <p>
            Ve tus ventas semanales, mensuales y anuales en gráficas que
            se actualizan solas. Identifica tu mejor día, tu producto
            estrella, y hacia dónde va creciendo tu negocio.
          </p>
        </div>

        <div className="landing-feature-card">
          <div className="landing-feature-icon" style={{ background: "#10b981" }}>
            <Receipt size={20} color="#fff" />
          </div>
          <h3>Facturación integrada</h3>
          <p>
            Cada venta puede convertirse en una factura profesional lista
            para imprimir o guardar como PDF, con folio y fecha
            automáticos — sin plantillas sueltas de Word.
          </p>
        </div>

        <div className="landing-feature-card">
          <div className="landing-feature-icon" style={{ background: "#ec4899" }}>
            <Palette size={20} color="#fff" />
          </div>
          <h3>8 temas, 6 idiomas</h3>
          <p>
            Oscuro, verde, azul, morado, ámbar, grafito, claro o rosa —
            en Español, English, Português, Français, Deutsch o 中文.
            Configúralo una vez y CoreStock se adapta a ti.
          </p>
        </div>

        <div className="landing-feature-card">
          <div className="landing-feature-icon" style={{ background: "#f59e0b" }}>
            <ShieldCheck size={20} color="#fff" />
          </div>
          <h3>Tus datos, protegidos</h3>
          <p>
            Cada cuenta ve únicamente su propia información. Además,
            puedes organizar tu equipo por roles — Administrador,
            Gerente, Cajero o Almacén — con permisos a la medida.
          </p>
        </div>

        <div className="landing-feature-card">
          <div className="landing-feature-icon" style={{ background: "#6366f1" }}>
            <Store size={20} color="#fff" />
          </div>
          <h3>Tu negocio, configurado</h3>
          <p>
            Nombre, logotipo, dirección, RFC, moneda y zona horaria —
            configura los datos de tu empresa una vez y aparecen listos
            en cada factura y reporte que generes.
          </p>
        </div>
      </section>

      {/* CÓMO EMPIEZA */}
      <section className="landing-pasos fade-up">
        <div className="landing-section-header">
          <span className="landing-badge">
            <Rocket size={13} /> Cómo empezar
          </span>
          <h2>De cero a vendiendo, en tres pasos</h2>
        </div>

        <div className="landing-pasos-grid">
          <div className="landing-paso">
            <span className="landing-paso-numero">1</span>
            <h3>Crea tu cuenta</h3>
            <p>Regístrate con tu correo — sin tarjeta, sin instalaciones, listo en menos de un minuto.</p>
          </div>

          <div className="landing-paso">
            <span className="landing-paso-numero">2</span>
            <h3>Carga tu inventario</h3>
            <p>Agrega tus productos con foto, precio y stock, o impórtalos desde tu Excel actual.</p>
          </div>

          <div className="landing-paso">
            <span className="landing-paso-numero">3</span>
            <h3>Vende y mide resultados</h3>
            <p>Registra ventas, factura al cliente, y ve tus gráficas actualizarse solas.</p>
          </div>
        </div>
      </section>

      {/* VISIÓN */}
      <section className="landing-vision fade-up">
        <div className="landing-vision-text">
          <span className="landing-badge">
            <Target size={13} /> Nuestra visión
          </span>

          <h2>
            Que ningún negocio pierda una venta
            <br /> por no saber qué tiene en su almacén.
          </h2>

          <p>
            Creamos CoreStock porque vimos a demasiados negocios llevar su
            inventario en cuadernos, hojas de cálculo sueltas o memoria —
            y perder dinero por ello: ventas de productos que ya no había,
            precios desactualizados, y horas perdidas buscando qué se
            vendió y qué no. Nuestra misión es simple: darle a cualquier
            negocio, sin importar su tamaño, las mismas herramientas de
            control y datos que usan las grandes cadenas — pero simples
            de usar desde el primer día.
          </p>
        </div>
      </section>


      {/* MUESTRA DE GRÁFICAS */}
      <section className="landing-preview fade-up">
        <div className="landing-section-header">
          <span className="landing-badge">
            <BarChart3 size={13} /> Así se ve por dentro
          </span>
          <h2>Tus números, de un vistazo</h2>
          <p>
            Nada de hojas de cálculo crípticas — gráficas claras, alertas
            visibles, y un Dashboard que se adapta a tu gusto (8 temas,
            6 idiomas).
          </p>
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
            <ArrowRightLeft size={13} /> La migración
          </span>
          <h2>¿Por qué dejar tu sistema de ventas actual?</h2>
          <p>
            Si hoy llevas tu negocio en cuadernos, WhatsApp, hojas de
            Excel sueltas o un sistema viejo que ya no te dice nada útil,
            esto es lo que cambia con CoreStock:
          </p>
        </div>

        <div className="landing-tabla-comparativa">
          <div className="landing-comp-col landing-comp-antes">
            <h3>Tu sistema actual</h3>
            <ul>
              <li><X size={15} /> No sabes tu stock real hasta que se acaba</li>
              <li><X size={15} /> Reportes de ventas armados a mano, tarde</li>
              <li><X size={15} /> Facturas hechas en Word o a mano</li>
              <li><X size={15} /> La información vive en un solo celular o PC</li>
              <li><X size={15} /> Ver "cómo va el negocio" toma horas</li>
              <li><X size={15} /> Un solo idioma, sin opción para tu equipo</li>
              <li><X size={15} /> Sin control de quién hizo qué venta</li>
            </ul>
          </div>

          <div className="landing-comp-col landing-comp-despues">
            <h3>Con CoreStock</h3>
            <ul>
              <li><Check size={15} /> Alertas automáticas de stock bajo y agotado</li>
              <li><Check size={15} /> Gráficas semanales, mensuales y anuales, en vivo</li>
              <li><Check size={15} /> Facturas generadas en 2 clics</li>
              <li><Check size={15} /> Accede desde cualquier dispositivo, con tu cuenta</li>
              <li><Check size={15} /> Tu Dashboard te lo resume en un vistazo</li>
              <li><Check size={15} /> 6 idiomas para ti y para tu equipo</li>
              <li><Check size={15} /> Roles y permisos por persona</li>
            </ul>
          </div>
        </div>

        <div className="landing-cta-group" style={{ justifyContent: "center", marginTop: 30 }}>
          <Link href="/login?modo=registro" className="btn-login landing-cta-primary">
            Cambiarme a CoreStock
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <p>© {new Date().getFullYear()} CoreStock — Sistema Inteligente de Inventario</p>
      </footer>
    </main>
  );
}
