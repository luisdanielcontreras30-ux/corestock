"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// El historial de ventas ahora vive dentro de /ventas (ya no es una
// página aparte en el menú). Esta ruta se mantiene solo por si alguien
// tiene el enlace viejo guardado, y redirige al lugar correcto.
export default function HistorialRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/ventas");
  }, [router]);

  return null;
}
