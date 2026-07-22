import { Package } from "lucide-react";

// Pantalla de arranque mientras se resuelve la sesión y el miembro
// activo (ver AppShell) — antes ese hueco se veía completamente vacío
// (el sidebar/header ya montados, con el área de contenido en blanco)
// hasta que la app terminaba de decidir qué mostrar. Reusa el mismo
// panel de marca (fondo + blobs) que Login para que la primera
// impresión sea consistente en toda la app, no solo al iniciar sesión.
export default function PantallaCarga() {
  return (
    <div className="pantalla-carga login-brand-panel">
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />

      <div className="pantalla-carga-contenido">
        <div className="pantalla-carga-hex">
          <Package size={30} color="#fff" />
        </div>
        <h1 className="pantalla-carga-titulo">CoreStock</h1>
        <div className="pantalla-carga-puntos">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
