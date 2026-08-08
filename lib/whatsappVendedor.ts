import { supabase } from "./supabase";

// Lleva el status HTTP para distinguir "sin cuota por ahora" (429) de
// cualquier otra falla, igual que ErrorAnalisisIA en iaAcciones.ts.
export class ErrorVendedorIA extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ErrorVendedorIA";
    this.status = status;
  }
}

export async function probarVendedorIA(pregunta: string, idioma: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Usuario no autenticado");
  }

  const respuesta = await fetch("/api/ia/vendedor-whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ pregunta, idioma }),
  });

  let datos: unknown;
  try {
    datos = await respuesta.json();
  } catch {
    throw new ErrorVendedorIA(
      `El servidor respondió con un error inesperado (HTTP ${respuesta.status}).`,
      respuesta.status
    );
  }

  if (!respuesta.ok) {
    const mensaje = (datos as { error?: string })?.error;
    throw new ErrorVendedorIA(mensaje || "No se pudo generar la respuesta.", respuesta.status);
  }

  return (datos as { respuesta: string }).respuesta;
}
