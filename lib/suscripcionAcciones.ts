import { supabase } from "./supabase";

async function obtenerToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Usuario no autenticado");
  }

  return token;
}

async function llamarRutaStripe(ruta: string): Promise<string> {
  const token = await obtenerToken();

  const respuesta = await fetch(ruta, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  const datos = await respuesta.json();

  if (!respuesta.ok || !datos.url) {
    throw new Error(datos.error || "No se pudo completar la operación.");
  }

  return datos.url as string;
}

export function iniciarCheckoutPlus(): Promise<string> {
  return llamarRutaStripe("/api/stripe/crear-sesion");
}

export function abrirPortalFacturacion(): Promise<string> {
  return llamarRutaStripe("/api/stripe/portal");
}
