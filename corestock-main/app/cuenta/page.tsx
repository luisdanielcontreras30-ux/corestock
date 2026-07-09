"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// La info de la cuenta ahora vive dentro de Configuración (pestaña
// "Mi cuenta"). Esta ruta se mantiene solo por compatibilidad y
// redirige al lugar correcto.
export default function CuentaRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/configuracion");
  }, [router]);

  return null;
}
