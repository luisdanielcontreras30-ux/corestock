import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import AppShell from "../components/AppShell";
import ThemeProvider from "../components/ThemeProvider";
import LanguageProvider from "../components/LanguageProvider";
import AuthProvider from "../components/AuthProvider";
import DemoSeedProvider from "../components/DemoSeedProvider";
import SuscripcionProvider from "../components/SuscripcionProvider";
import ToastProvider from "../components/ToastProvider";
import ConfirmProvider from "../components/ConfirmProvider";
import MiembroActivoProvider from "../components/MiembroActivoProvider";

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
          <DemoSeedProvider>
            <MiembroActivoProvider>
              <SuscripcionProvider>
                <ThemeProvider>
                  <LanguageProvider>
                    <ToastProvider>
                      <ConfirmProvider>
                        <AppShell>{children}</AppShell>
                      </ConfirmProvider>
                    </ToastProvider>
                  </LanguageProvider>
                </ThemeProvider>
              </SuscripcionProvider>
            </MiembroActivoProvider>
          </DemoSeedProvider>
        </AuthProvider>
      </body>
    </html>
  );
}