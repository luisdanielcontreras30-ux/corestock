import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verificarUsuarioApi } from "../../../../lib/verificarUsuarioApi";
import { generarRespuestaVendedor, ErrorGoogleAI, ProductoParaVendedor } from "../../../../lib/googleAI";
import { tieneAccesoBeta } from "../../../../lib/betaAcceso";

// Tope generoso para una pregunta de cliente por WhatsApp — evita
// mandar textos absurdamente largos al prompt sin motivo real.
const LARGO_MAXIMO_PREGUNTA = 500;

const MENSAJES: Record<string, Record<string, string>> = {
  no_autenticado: { es: "No autenticado.", en: "Not authenticated.", pt: "Não autenticado.", fr: "Non authentifié.", de: "Nicht authentifiziert.", zh: "未认证。", it: "Non autenticato." },
  cuerpo_invalido: { es: "Cuerpo de la solicitud inválido.", en: "Invalid request body.", pt: "Corpo da solicitação inválido.", fr: "Corps de la requête invalide.", de: "Ungültiger Anfragetext.", zh: "请求正文无效。", it: "Corpo della richiesta non valido." },
  falta_pregunta: { es: "Escribe una pregunta para probar el vendedor.", en: "Type a question to test the seller.", pt: "Digite uma pergunta para testar o vendedor.", fr: "Saisissez une question pour tester le vendeur.", de: "Gib eine Frage ein, um den Verkäufer zu testen.", zh: "请输入一个问题来测试销售助手。", it: "Scrivi una domanda per testare il venditore." },
  fallo_respuesta: { es: "No se pudo generar la respuesta. Intenta de nuevo en un momento.", en: "Couldn't generate the reply. Try again in a moment.", pt: "Não foi possível gerar a resposta. Tente novamente em instantes.", fr: "Impossible de générer la réponse. Réessayez dans un instant.", de: "Antwort konnte nicht erstellt werden. Versuche es gleich noch einmal.", zh: "无法生成回复，请稍后重试。", it: "Impossibile generare la risposta. Riprova tra un momento." },
  cuota_excedida: { es: "Se alcanzó el límite de análisis con IA por ahora. Intenta de nuevo más tarde (en unos minutos u horas).", en: "The AI limit was reached for now. Try again later (in a few minutes or hours).", pt: "O limite de IA foi atingido por agora. Tente novamente mais tarde (em alguns minutos ou horas).", fr: "La limite d'IA a été atteinte pour le moment. Réessayez plus tard (dans quelques minutes ou heures).", de: "Das KI-Limit wurde vorübergehend erreicht. Versuche es später erneut (in ein paar Minuten oder Stunden).", zh: "AI 次数已达上限，请稍后再试（几分钟或几小时后）。", it: "Il limite IA è stato raggiunto per ora. Riprova più tardi (tra qualche minuto o ora)." },
  configuracion_invalida: { es: "El vendedor con IA no está disponible en este momento. Contacta a soporte.", en: "The AI seller isn't available right now. Contact support.", pt: "O vendedor com IA não está disponível no momento. Entre em contato com o suporte.", fr: "Le vendeur IA n'est pas disponible pour le moment. Contactez le support.", de: "Der KI-Verkäufer ist derzeit nicht verfügbar. Wende dich an den Support.", zh: "AI 销售助手目前不可用，请联系支持团队。", it: "Il venditore IA non è disponibile al momento. Contatta l'assistenza." },
};

function mensaje(clave: keyof typeof MENSAJES, idioma: string) {
  return MENSAJES[clave][idioma] ?? MENSAJES[clave].es;
}

export async function POST(request: Request) {
  const user = await verificarUsuarioApi(request);

  if (!user) {
    return NextResponse.json({ error: mensaje("no_autenticado", "es") }, { status: 401 });
  }

  // Beta cerrada — mismo criterio que el sidebar (ver lib/betaAcceso.ts),
  // pero comprobado también acá: ocultar el botón en la interfaz no
  // alcanza si esta ruta sigue respondiendo a quien la llame directo.
  if (!tieneAccesoBeta(user.email)) {
    return NextResponse.json({ error: mensaje("no_autenticado", "es") }, { status: 403 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: mensaje("cuerpo_invalido", "es") }, { status: 400 });
  }

  const { pregunta: preguntaBruta, idioma: idiomaBruto } = (cuerpo ?? {}) as {
    pregunta?: unknown;
    idioma?: unknown;
  };

  const idioma = typeof idiomaBruto === "string" ? idiomaBruto : "es";

  if (typeof preguntaBruta !== "string" || !preguntaBruta.trim()) {
    return NextResponse.json({ error: mensaje("falta_pregunta", idioma) }, { status: 400 });
  }

  const pregunta = preguntaBruta.trim().slice(0, LARGO_MAXIMO_PREGUNTA);

  // Cliente con el JWT del dueño (no la service_role key): la lectura
  // de productos queda sujeta a RLS igual que cualquier consulta desde
  // el navegador, en vez de depender de un filtro manual por user_id.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    return NextResponse.json({ error: mensaje("fallo_respuesta", idioma) }, { status: 500 });
  }

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: request.headers.get("authorization") ?? "" } },
  });

  const { data: productos, error: errorProductos } = await supabase
    .from("productos")
    .select("nombre, categoria, precio_venta, stock")
    .eq("activo", true)
    .order("nombre");

  if (errorProductos) {
    console.error(errorProductos);
    return NextResponse.json({ error: mensaje("fallo_respuesta", idioma) }, { status: 500 });
  }

  try {
    const respuestaTexto = await generarRespuestaVendedor(
      pregunta,
      (productos ?? []) as ProductoParaVendedor[],
      idioma
    );
    return NextResponse.json({ respuesta: respuestaTexto });
  } catch (error) {
    console.error(error);

    if (error instanceof ErrorGoogleAI) {
      if (error.status === 429) {
        return NextResponse.json({ error: mensaje("cuota_excedida", idioma) }, { status: 429 });
      }
      if (error.status === 401 || error.status === 403) {
        return NextResponse.json({ error: mensaje("configuracion_invalida", idioma) }, { status: 500 });
      }
    }

    return NextResponse.json({ error: mensaje("fallo_respuesta", idioma) }, { status: 500 });
  }
}
