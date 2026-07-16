"use client";

import { useEffect } from "react";

// Registra el Service Worker (public/sw.js) apenas carga la app. Sin
// esto, ninguna pantalla quedaría disponible sin conexión aunque el
// resto de la infraestructura offline (Dexie, cola de sincronización)
// funcione — el shell de la app también tiene que poder servirse
// desde caché.
export default function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("No se pudo registrar el Service Worker:", error);
    });
  }, []);

  return null;
}
