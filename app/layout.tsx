import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import AppShell from "../components/AppShell";
import ThemeProvider from "../components/ThemeProvider";
import LanguageProvider from "../components/LanguageProvider";
import AuthProvider from "../components/AuthProvider";
import SuscripcionProvider from "../components/SuscripcionProvider";
import ToastProvider from "../components/ToastProvider";

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
          <SuscripcionProvider>
            <ThemeProvider>
              <LanguageProvider>
                <ToastProvider>
                  <AppShell>{children}</AppShell>
                </ToastProvider>
              </LanguageProvider>
            </ThemeProvider>
          </SuscripcionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}