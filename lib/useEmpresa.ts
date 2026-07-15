import { useEffect, useState } from "react";
import { cargarEmpresa } from "../app/configuracion/acciones";
import { EmpresaConfig } from "../app/configuracion/types";

// Datos del negocio (nombre, logo, RFC, dirección) para mostrar en
// documentos que ve el cliente final (facturas, cotizaciones) en vez
// de la marca "CoreStock" del software.
export function useEmpresa() {
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(null);

  useEffect(() => {
    cargarEmpresa()
      .then(setEmpresa)
      .catch((error) => console.error(error));
  }, []);

  return empresa;
}
