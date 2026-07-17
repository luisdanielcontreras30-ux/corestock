import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ReactNode } from "react";
import AppShell from "../components/AppShell";
import SwRegister from "../components/SwRegister";
import ThemeProvider from "../components/ThemeProvider";
import LanguageProvider from "../components/LanguageProvider";
import AuthProvider from "../components/AuthProvider";
import DemoSeedProvider from "../components/DemoSeedProvider";
import SuscripcionProvider from "../components/SuscripcionProvider";
import ModoInterfazProvider from "../components/ModoInterfazProvider";
import ToastProvider from "../components/ToastProvider";
import ConfirmProvider from "../components/ConfirmProvider";
import MiembroActivoProvider from "../components/MiembroActivoProvider";
import SyncProvider from "../components/SyncProvider";

export const metadata: Metadata = {
  title: "CoreStock",
  description: "Sistema de Inventario",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    // Habilita "Agregar a inicio" en iOS con barra de estado a tono,
    // sin la barra de Safari — se comporta como app instalada.
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CoreStock",
  },
  other: {
    // Next solo emite el meta estándar "mobile-web-app-capable" — se
    // agrega también el específico de Apple para iOS/Safari viejos que
    // todavía no reconocen el estándar nuevo.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#5945e4",
  width: "device-width",
  initialScale: 1,
  // Sin esto, la app instalada (PWA) se sentía como una página web
  // cualquiera: se podía hacer pinch-zoom para achicarla/agrandarla y,
  // ya con zoom, arrastrarla hacia los lados — nada de eso pasa en una
  // app nativa de verdad. maximumScale 1 + userScalable false bloquea
  // el pellizco para agrandar/achicar, que es justo lo que hace que
  // una PWA en "standalone" (ver manifest.json) se sienta como una
  // app y no como una pestaña de navegador.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <SwRegister />
        <AuthProvider>
          <SyncProvider>
            <DemoSeedProvider>
              <MiembroActivoProvider>
                <SuscripcionProvider>
                  <ModoInterfazProvider>
                    <ThemeProvider>
                      <LanguageProvider>
                        <ToastProvider>
                          <ConfirmProvider>
                            <AppShell>{children}</AppShell>
                          </ConfirmProvider>
                        </ToastProvider>
                      </LanguageProvider>
                    </ThemeProvider>
                  </ModoInterfazProvider>
                </SuscripcionProvider>
              </MiembroActivoProvider>
            </DemoSeedProvider>
          </SyncProvider>
        </AuthProvider>
      </body>
    </html>
  );
}