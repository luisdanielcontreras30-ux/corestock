"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIdioma } from "./LanguageProvider";
import { SECCIONES_NAV, RUTAS_PERMITIDAS_MIEMBRO, ItemNav } from "../lib/navegacion";
import { RUTAS_SIEMPRE_VISIBLES, obtenerRutasEasy } from "../lib/tiposNegocio";
import { esRutaPlus } from "../lib/suscripcion";
import { esRutaBetaCerrada, tieneAccesoBeta } from "../lib/betaAcceso";
import { useMiembroActivo } from "./MiembroActivoProvider";
import { useModoInterfaz } from "./ModoInterfazProvider";
import { useTipoNegocio } from "./TipoNegocioProvider";
import { useAuth } from "./AuthProvider";

export default function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { t } = useIdioma();
  const { user } = useAuth();
  const { miembroActivo, puede } = useMiembroActivo();
  const { esEasy } = useModoInterfaz();
  const { rutasActivas, tipoNegocio } = useTipoNegocio();

  const todosLosItems = SECCIONES_NAV.flatMap((s) => s.items);

  // Un miembro del equipo SIEMPRE ve el sidebar en su forma simple y
  // plana (sin secciones/categorías) — igual que el modo Easy, pero
  // con SUS rutas permitidas (RUTAS_PERMITIDAS_MIEMBRO) en vez de las
  // de Easy, sin importar si el negocio está en modo Easy o Completo.
  // Antes caía en la rama de abajo (SECCIONES_NAV agrupado por
  // secciones): terminaba viendo pocos accesos, pero repartidos en
  // varias categorías con título — se veía como una versión reducida
  // del panel completo en vez de algo realmente simple.
  const itemsMiembro = miembroActivo
    ? RUTAS_PERMITIDAS_MIEMBRO.filter((href) => {
        if (href === "/ventas" && !puede("ver_ventas")) return false;
        if (href === "/ventas-rapidas" && !puede("registrar_ventas")) return false;
        if (href === "/productos" && !puede("ver_inventario") && !puede("gestionar_inventario")) return false;
        return true;
      })
        .concat(puede("configuracion") ? ["/configuracion"] : [])
        .map((href) => todosLosItems.find((item) => item.href === href))
        .filter((item): item is NonNullable<typeof item> => !!item)
    : null;

  // En modo Easy (y solo para el dueño), el sidebar colapsa a lo
  // esencial, sin secciones ni categorías — la lista exacta depende
  // del tipo de negocio (ver obtenerRutasEasy).
  const itemsEasy = esEasy && !miembroActivo
    ? obtenerRutasEasy(tipoNegocio).map((href) =>
        todosLosItems.find((item) => item.href === href)
      ).filter((item): item is NonNullable<typeof item> => !!item)
    : null;

  const itemsPlanos = itemsMiembro ?? itemsEasy;

  function renderLink(item: ItemNav) {
    const isActive = pathname === item.href;
    const Icono = item.Icono;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        className={`sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
      >
        <Icono
          size={17}
          className="sidebar-link-icon"
          color={isActive ? "var(--primary)" : "var(--text-secondary)"}
        />
        <span className="sidebar-link-label">{t(item.claveNombre)}</span>
        {item.proximamente && (
          <span className="sidebar-link-badge">{t("proximamente.badge")}</span>
        )}
        {!item.proximamente && esRutaPlus(item.href) && (
          <span className="sidebar-link-badge-plus" title={t("plus.badge_tooltip")}>Plus+</span>
        )}
      </Link>
    );
  }

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar-v2 ${isOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <h2>
            <span className="sidebar-brand-icon">⬢</span> CoreStock
          </h2>
          <p>SISTEMA DE INVENTARIO</p>
        </div>

        <nav className="sidebar-nav">
          {itemsPlanos ? (
            <div className="sidebar-section">
              {itemsPlanos.map((item) => renderLink(item))}
            </div>
          ) : (
            SECCIONES_NAV.map((seccion) => {
              const itemsVisibles = seccion.items.filter((item) => {
                // Esta rama ya solo corre para el dueño (itemsPlanos
                // cubre a cualquier miembro del equipo arriba).
                // Empleados IA / WhatsApp: en beta cerrada, solo visibles
                // para la cuenta que los está probando (ver lib/betaAcceso.ts).
                if (esRutaBetaCerrada(item.href) && !tieneAccesoBeta(user?.email)) return false;
                // Personalización por tipo de negocio (Configuración >
                // Personalización): NUNCA bloquea, solo decide qué se
                // ve de entrada en el menú — la ruta sigue funcionando
                // por URL directa o desde "Más". rutasActivas === null
                // significa "sin personalizar", se ve todo.
                if (
                  rutasActivas !== null &&
                  !RUTAS_SIEMPRE_VISIBLES.includes(item.href) &&
                  !rutasActivas.includes(item.href)
                )
                  return false;
                return true;
              });

              if (itemsVisibles.length === 0) return null;

              return (
                <div key={seccion.claveTitulo} className="sidebar-section">
                  <p className="sidebar-section-title">{t(seccion.claveTitulo)}</p>
                  {itemsVisibles.map((item) => renderLink(item))}
                </div>
              );
            })
          )}
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-footer-text">CoreStock v2</p>
        </div>
      </aside>
    </>
  );
}
