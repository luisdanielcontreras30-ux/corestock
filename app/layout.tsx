import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import AppShell from "../components/AppShell";
import ThemeProvider from "../components/ThemeProvider";
import LanguageProvider from "../components/LanguageProvider";
import AuthProvider from "../components/AuthProvider";

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
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <AppShell>{children}</AppShell>
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}