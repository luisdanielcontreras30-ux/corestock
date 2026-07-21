import { supabase } from "../../lib/supabase";
import { obtenerNegocioId } from "../../lib/negocioActual";

async function obtenerUsuarioActual() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  return user;
}

export async function cargarNumeroWhatsApp(): Promise<string | null> {
  await obtenerUsuarioActual();

  const { data, error } = await supabase
    .from("empresa_config")
    .select("whatsapp_phone_number_id")
    .maybeSingle();

  if (error) throw error;

  return (data?.whatsapp_phone_number_id as string | null) ?? null;
}

export async function guardarNumeroWhatsApp(phoneNumberId: string): Promise<void> {
  await obtenerUsuarioActual();
  const negocioId = await obtenerNegocioId();

  // update en vez de upsert: si todavía no existe la fila de
  // empresa_config (el negocio nunca guardó Configuración → Empresa),
  // un upsert insertaría una fila nueva sin el resto de los campos.
  // Mejor pedirle que configure Empresa primero.
  const { data, error } = await supabase
    .from("empresa_config")
    .update({ whatsapp_phone_number_id: phoneNumberId.trim() || null })
    .eq("user_id", negocioId)
    .select("user_id");

  if (error) throw error;

  if (!data || data.length === 0) {
    // Sentinel sin traducir a propósito — mismo patrón que
    // catalogo-linea/acciones.ts. page.tsx lo traduce.
    throw new Error("EMPRESA_NO_CONFIGURADA");
  }
}
