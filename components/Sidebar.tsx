"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  // Configuración de los botones de navegación
  const menuItems = [
    { name: "Dashboard", href: "/menu", icon: "📊" },
    { name: "Productos", href: "/productos", icon: "📦" },
    { name: "Ventas", href: "/ventas", icon: "💰" },
    { name: "Historial", href: "/historial", icon: "📋" },
    { name: "Gráficas", href: "/graficas", icon: "📈" },
    { name: "Cuenta", href: "/cuenta", icon: "👤" },
  ];

  return (
    <aside style={{
      width: "260px",
      minHeight: "100vh",
      backgroundColor: "#0c0d16", // Fondo ligeramente más oscuro que el dashboard para dar profundidad
      borderRight: "1px solid #1c1f3b",
      padding: "24px 16px",
      display: "flex",
      flexDirection: "column",
      fontFamily: "sans-serif",
      position: "sticky",
      top: 0
    }}>
      
      {/* LOGO / BRANDING */}
      <div style={{ marginBottom: "32px", paddingLeft: "8px" }}>
        <h2 style={{ color: "#ffffff", fontSize: "19px", fontWeight: "700", margin: 0, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "#5945e4" }}>⬢</span> CoreStock
        </h2>
        <p style={{ color: "#4e5264", fontSize: "11px", margin: "4px 0 0 0", fontWeight: "500" }}>SISTEMA DE INVENTARIO</p>
      </div>

      {/* MENÚ DE NAVEGACIÓN */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 14px",
                borderRadius: "10px",
                color: isActive ? "#ffffff" : "#61667a",
                backgroundColor: isActive ? "rgba(89, 69, 228, 0.15)" : "transparent",
                border: isActive ? "1px solid rgba(89, 69, 228, 0.3)" : "1px solid transparent",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: isActive ? "600" : "500",
                transition: "all 0.2s ease",
              }}
              // Efecto hover simple integrado
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "#ffffff";
                  e.currentTarget.style.backgroundColor = "#121424";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "#61667a";
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <span style={{ 
                fontSize: "16px", 
                filter: isActive ? "none" : "grayscale(100%) opacity(0.7)" 
              }}>
                {item.icon}
              </span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* FOOTER DE LA BARRA LATERAL */}
      <div style={{ borderTop: "1px solid #16182c", paddingTop: "16px", paddingLeft: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#5945e4", display: "grid", placeItems: "center", fontSize: "13px", fontWeight: "600", color: "#ffffff" }}>
            U
          </div>
          <div>
            <p style={{ color: "#ffffff", fontSize: "13px", fontWeight: "600", margin: 0 }}>Usuario Activo</p>
            <p style={{ color: "#4e5264", fontSize: "11px", margin: 0 }}>Sesión protegida</p>
          </div>
        </div>
      </div>

    </aside>
  );
}