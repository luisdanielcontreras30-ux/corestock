import { supabase } from "../../lib/supabase";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { tieneAccesoBeta } from "../../lib/betaAcceso";

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
  const user = await obtenerUsuarioActual();

  // El módulo está en beta cerrada — page.tsx ya oculta/redirige fuera
  // de /whatsapp a quien no tiene acceso, pero esta acción es
  // exportada y podría llamarse directamente sin pasar por esa
  // pantalla, así que se repite el mismo chequeo aquí.
  if (!tieneAccesoBeta(user.email)) {
    throw new Error("SIN_ACCESO_BETA");
  }

  const negocioId = await obtenerNegocioId(user.id);

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
