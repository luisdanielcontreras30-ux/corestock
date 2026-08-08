import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { obtenerSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { generarRespuestaVendedor, ProductoParaVendedor } from "../../../../lib/googleAI";

const GRAPH_API_VERSION = "v21.0";

interface ValorWebhook {
  metadata?: { phone_number_id?: string };
  messages?: { from?: string; type?: string; text?: { body?: string } }[];
}

// Si Gemini falla (cuota agotada, clave inválida, etc.) un cliente
// real esperando respuesta no debe quedarse sin nada — se manda esto
// en vez de silencio total, para que sepa que su mensaje sí llegó.
const MENSAJE_FALLBACK: Record<string, string> = {
  es: "¡Gracias por escribirnos! En un momento te contestamos.",
  en: "Thanks for reaching out! We'll get back to you shortly.",
  pt: "Obrigado por escrever! Já já te respondemos.",
  fr: "Merci de nous avoir écrit ! Nous vous répondrons sous peu.",
  de: "Danke für deine Nachricht! Wir melden uns gleich bei dir.",
  zh: "感谢您的留言！我们会尽快回复您。",
  it: "Grazie per averci scritto! Ti risponderemo a breve.",
};

// GET: handshake de verificación que Meta hace una sola vez, al
// guardar esta URL como webhook en su panel de desarrolladores.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modo = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const tokenEsperado = process.env.WHATSAPP_VERIFY_TOKEN;

  if (modo === "subscribe" && tokenEsperado && token === tokenEsperado) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// Meta firma cada callback con WHATSAPP_APP_SECRET (HMAC-SHA256 sobre
// el cuerpo crudo, header X-Hub-Signature-256) — sin verificar esto,
// cualquiera que adivine o filtre el phone_number_id de un negocio
// podría hacer llamadas falsas a este endpoint para gastar su cuota de
// Gemini o hacer que el negocio le mande WhatsApps arbitrarios a
// cualquier número. Mismo criterio "fail closed" que ya usa el webhook
// de Stripe (ver app/api/stripe/webhook/route.ts) ante firma o secreto
// faltante.
function firmaValida(cuerpoCrudo: string, firmaHeader: string | null, secreto: string): boolean {
  if (!firmaHeader) return false;

  const esperada = "sha256=" + createHmac("sha256", secreto).update(cuerpoCrudo).digest("hex");
  const bufferRecibido = Buffer.from(firmaHeader);
  const bufferEsperado = Buffer.from(esperada);

  // Deben medir igual antes de comparar: timingSafeEqual lanza si los
  // buffers tienen longitudes distintas, en vez de simplemente devolver
  // false.
  if (bufferRecibido.length !== bufferEsperado.length) return false;

  return timingSafeEqual(bufferRecibido, bufferEsperado);
}

// POST: mensajes entrantes de clientes reales por WhatsApp.
export async function POST(request: Request) {
  const secreto = process.env.WHATSAPP_APP_SECRET;
  const firmaHeader = request.headers.get("x-hub-signature-256");
  const cuerpoCrudo = await request.text();

  if (!secreto || !firmaValida(cuerpoCrudo, firmaHeader, secreto)) {
    console.error(
      "Webhook de WhatsApp rechazado: firma inválida o falta WHATSAPP_APP_SECRET en el servidor."
    );
    return new NextResponse("Forbidden", { status: 403 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(cuerpoCrudo);
  } catch {
    // Meta reintenta el envío si no respondemos 200 — un cuerpo
    // ilegible no es algo que un reintento vaya a arreglar, así que se
    // responde 200 igual para no generar una tormenta de reintentos.
    return NextResponse.json({ ok: true });
  }

  try {
    await procesarWebhook(cuerpo);
  } catch (error) {
    // Cualquier falla al procesar (IA caída, negocio no encontrado,
    // etc.) se registra pero igual se responde 200 más abajo — un
    // mensaje que no se pudo contestar automáticamente no debe
    // convertirse en reintentos infinitos de parte de Meta.
    console.error("Error procesando webhook de WhatsApp:", error);
  }

  return NextResponse.json({ ok: true });
}

async function procesarWebhook(cuerpo: unknown) {
  const entradas = (cuerpo as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entradas)) return;

  for (const entrada of entradas) {
    const cambios = (entrada as { changes?: unknown[] })?.changes;
    if (!Array.isArray(cambios)) continue;

    for (const cambio of cambios) {
      const valor = (cambio as { value?: ValorWebhook })?.value;
      const phoneNumberId = valor?.metadata?.phone_number_id;
      const mensajes = valor?.messages;

      if (!phoneNumberId || !Array.isArray(mensajes)) continue;

      for (const mensaje of mensajes) {
        // Fase 2 solo entiende texto por ahora — audios, imágenes,
        // ubicaciones, etc. se ignoran en vez de fallar.
        if (mensaje.type !== "text" || !mensaje.from || !mensaje.text?.body) continue;

        await responderMensaje(phoneNumberId, mensaje.from, mensaje.text.body);
      }
    }
  }
}

async function responderMensaje(phoneNumberId: string, deNumero: string, texto: string) {
  const admin = obtenerSupabaseAdmin();

  const { data: empresa, error: errorEmpresa } = await admin
    .from("empresa_config")
    .select("user_id, idioma")
    .eq("whatsapp_phone_number_id", phoneNumberId)
    .maybeSingle();

  if (errorEmpresa || !empresa) {
    console.error("No se encontró un negocio conectado a phone_number_id", phoneNumberId, errorEmpresa);
    return;
  }

  const { data: productos, error: errorProductos } = await admin
    .from("productos")
    .select("nombre, categoria, precio_venta, stock")
    .eq("user_id", empresa.user_id)
    .eq("activo", true)
    .order("nombre");

  if (errorProductos) {
    console.error("Error leyendo productos para el vendedor de WhatsApp:", errorProductos);
    return;
  }

  const idioma = (empresa.idioma as string) || "es";

  let respuesta: string;
  try {
    // Mismo tope que en la ruta de prueba (vendedor-whatsapp/route.ts).
    respuesta = await generarRespuestaVendedor(
      texto.slice(0, 500),
      (productos ?? []) as ProductoParaVendedor[],
      idioma
    );
  } catch (error) {
    console.error("Fallo generando la respuesta del vendedor de WhatsApp:", error);
    respuesta = MENSAJE_FALLBACK[idioma] ?? MENSAJE_FALLBACK.es;
  }

  await enviarMensajeWhatsApp(phoneNumberId, deNumero, respuesta);
}

async function enviarMensajeWhatsApp(phoneNumberId: string, aNumero: string, texto: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!token) {
    console.error("Falta configurar WHATSAPP_ACCESS_TOKEN en el servidor.");
    return;
  }

  const respuesta = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: aNumero,
        type: "text",
        text: { body: texto },
      }),
    }
  );

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => "");
    console.error("Error enviando mensaje de WhatsApp:", respuesta.status, detalle);
  }
}
