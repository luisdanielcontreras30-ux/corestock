import { supabase } from "../../lib/supabase";
import { SugerenciaCliente } from "./types";

export class ErrorAnalisisClientes extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ErrorAnalisisClientes";
    this.status = status;
  }
}

export async function analizarClientesFrecuentes(idioma: string): Promise<SugerenciaCliente[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Usuario no autenticado");
  }

  const respuesta = await fetch("/api/ia/sugerencias-recompra", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ idioma }),
  });

  let datos: unknown;
  try {
    datos = await respuesta.json();
  } catch {
    throw new ErrorAnalisisClientes(
      `El servidor respondió con un error inesperado (HTTP ${respuesta.status}).`,
      respuesta.status
    );
  }

  if (!respuesta.ok) {
    const mensaje = (datos as { error?: string })?.error;
    throw new ErrorAnalisisClientes(mensaje || "No se pudo analizar a los clientes.", respuesta.status);
  }

  return ((datos as { sugerencias?: SugerenciaCliente[] })?.sugerencias ?? []);
}
