"use client";

import Link from "next/link";
import {
  Package,
  BarChart3,
  Receipt,
  Palette,
  ShieldCheck,
  Sparkles,
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

        <Link href="/login" className="landing-nav-cta">
          Iniciar sesión
        </Link>
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
            <Link href="/login" className="btn-login landing-cta-primary">
              Comenzar ahora
            </Link>
            <Link href="/login" className="landing-cta-secondary">
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
          <p>Sube fotos de cada producto y ten tu catálogo siempre organizado.</p>
        </div>

        <div className="landing-feature-card">
          <div className="landing-feature-icon" style={{ background: "#3b82f6" }}>
            <BarChart3 size={20} color="#fff" />
          </div>
          <h3>Gráficas en tiempo real</h3>
          <p>Ventas semanales, mensuales y anuales, siempre actualizadas.</p>
        </div>

        <div className="landing-feature-card">
          <div className="landing-feature-icon" style={{ background: "#10b981" }}>
            <Receipt size={20} color="#fff" />
          </div>
          <h3>Facturación integrada</h3>
          <p>Genera e imprime facturas de tus ventas en un par de clics.</p>
        </div>

        <div className="landing-feature-card">
          <div className="landing-feature-icon" style={{ background: "#ec4899" }}>
            <Palette size={20} color="#fff" />
          </div>
          <h3>5 temas visuales</h3>
          <p>Oscuro, verde, azul, claro o rosa pastel — a tu gusto.</p>
        </div>

        <div className="landing-feature-card">
          <div className="landing-feature-icon" style={{ background: "#f59e0b" }}>
            <ShieldCheck size={20} color="#fff" />
          </div>
          <h3>Tus datos, protegidos</h3>
          <p>Cada cuenta ve únicamente su propia información.</p>
        </div>
      </section>

      <footer className="landing-footer">
        <p>© {new Date().getFullYear()} CoreStock — Sistema Inteligente de Inventario</p>
      </footer>
    </main>
  );
}
