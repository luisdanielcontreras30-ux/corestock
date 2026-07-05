import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import Sidebar from "../components/Sidebar";

export const metadata: Metadata = {
  title: "CoreStock",
  description: "Sistema de Inventario",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="es">
      <body>

        <div className="app-layout">

          <Sidebar />

          <div className="main-content">
            {children}
          </div>

        </div>

      </body>
    </html>
  );
}