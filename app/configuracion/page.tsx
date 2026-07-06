"use client";

import React from "react";
import { useTheme, Tema } from "../../components/ThemeProvider";

interface OpcionTema {
  valor: Tema;
  nombre: string;
  descripcion: string;
  colores: string[];
}

const opciones: OpcionTema[] = [
  {
    valor: "dark",
    nombre: "Oscuro",
    descripcion: "El tema clásico de CoreStock",
    colores: ["#090a14", "#121424", "#5945e4"],
  },
  {
    valor: "green",
    nombre: "Verde",
    descripcion: "Oscuro con acento esmeralda",
    colores: ["#071310", "#0e231c", "#10b981"],
  },
  {
    valor: "blue",
    nombre: "Azul",
    descripcion: "Oscuro con acento azul",
    colores: ["#060b16", "#101a2e", "#3b82f6"],
  },
  {
    valor: "light",
    nombre: "Claro",
    descripcion: "Fondo blanco, ideal para el día",
    colores: ["#f5f6fb", "#ffffff", "#5945e4"],
  },
  {
    valor: "pink",
    nombre: "Rosa pastel",
    descripcion: "Suave y cálido",
    colores: ["#fdf3f8", "#fff8fb", "#ec4899"],
  },
];

export default function ConfiguracionPage() {
  const { tema, cambiarTema } = useTheme();

  return (
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 34, fontWeight: 700 }}>Configuración</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Personaliza la apariencia de CoreStock.
        </p>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 6 }}>Tema de la aplicación</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 20, fontSize: 13 }}>
          Elige el tema con el que quieres usar CoreStock. Se guarda solo en este
          dispositivo.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          {opciones.map((opcion) => {
            const activo = tema === opcion.valor;

            return (
              <button
                key={opcion.valor}
                onClick={() => cambiarTema(opcion.valor)}
                style={{
                  textAlign: "left",
                  padding: 16,
                  borderRadius: "var(--radius-lg)",
                  border: activo
                    ? "2px solid var(--primary)"
                    : "1px solid var(--border)",
                  background: "var(--card-hover)",
                  cursor: "pointer",
                  transition: "border-color .2s ease, transform .15s ease",
                }}
              >
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {opcion.colores.map((c, i) => (
                    <span
                      key={i}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: c,
                        border: "1px solid rgba(255,255,255,0.15)",
                        display: "inline-block",
                      }}
                    />
                  ))}
                </div>

                <p
                  style={{
                    color: "var(--text-primary)",
                    fontWeight: 700,
                    fontSize: 15,
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {opcion.nombre}
                  {activo && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--primary)",
                        fontWeight: 700,
                      }}
                    >
                      ● Activo
                    </span>
                  )}
                </p>

                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: 12.5,
                    margin: "4px 0 0 0",
                  }}
                >
                  {opcion.descripcion}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
