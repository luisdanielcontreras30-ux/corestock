import { NextResponse } from "next/server";
import { verificarUsuarioApi } from "../../../../lib/verificarUsuarioApi";
import { analizarImagenProducto, ErrorGoogleAI, hayGoogleAI } from "../../../../lib/googleAI";
import { analizarImagenProductoGroq, ErrorGroq } from "../../../../lib/groq";

// El cliente ya redimensiona la foto antes de mandarla (ver
// lib/iaAcciones.ts), así que en el caso normal esto pesa muy poco.
// Este tope es solo una red de seguridad para el caso raro en que el
// redimensionado falla y se manda la imagen original tal cual.
const TAMANO_MAXIMO_BASE64 = 6 * 1024 * 1024;

const TIPOS_PERMITIDOS = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

// Mensajes que sí llegan al usuario final (dueños de negocio en beta,
// no solo el desarrollador) — por eso van traducidos al idioma de la
// app y nunca incluyen el texto crudo de un error de proveedor externo
// (ej. Gemini), que queda solo en el console.error del servidor.
const MENSAJES: Record<string, Record<string, string>> = {
  no_autenticado: { es: "No autenticado.", en: "Not authenticated.", pt: "Não autenticado.", fr: "Non authentifié.", de: "Nicht authentifiziert.", zh: "未认证。", it: "Non autenticato." },
  cuerpo_invalido: { es: "Cuerpo de la solicitud inválido.", en: "Invalid request body.", pt: "Corpo da solicitação inválido.", fr: "Corps de la requête invalide.", de: "Ungültiger Anfragetext.", zh: "请求正文无效。", it: "Corpo della richiesta non valido." },
  falta_imagen: { es: "Falta la imagen a analizar.", en: "Missing image to analyze.", pt: "Falta a imagem a analisar.", fr: "Image à analyser manquante.", de: "Bild zum Analysieren fehlt.", zh: "缺少要分析的图片。", it: "Manca l'immagine da analizzare." },
  tipo_no_soportado: { es: "Tipo de imagen no soportado.", en: "Unsupported image type.", pt: "Tipo de imagem não suportado.", fr: "Type d'image non pris en charge.", de: "Nicht unterstützter Bildtyp.", zh: "不支持的图片类型。", it: "Tipo di immagine non supportato." },
  imagen_muy_grande: { es: "La imagen es demasiado grande.", en: "The image is too large.", pt: "A imagem é muito grande.", fr: "L'image est trop grande.", de: "Das Bild ist zu groß.", zh: "图片太大。", it: "L'immagine è troppo grande." },
  fallo_analisis: { es: "No se pudo analizar la imagen. Intenta de nuevo en un momento.", en: "Couldn't analyze the image. Try again in a moment.", pt: "Não foi possível analisar a imagem. Tente novamente em instantes.", fr: "Impossible d'analyser l'image. Réessayez dans un instant.", de: "Bild konnte nicht analysiert werden. Versuche es gleich noch einmal.", zh: "无法分析图片，请稍后重试。", it: "Impossibile analizzare l'immagine. Riprova tra un momento." },
  // Estos dos NO se van a resolver reintentando — a diferencia de
  // fallo_analisis (una falla transitoria real), acá conviene decirle
  // al dueño que espere un rato largo (cuota) o que avise al soporte
  // (configuración), en vez del mismo "intenta de nuevo" de siempre.
  cuota_excedida: { es: "Se alcanzó el límite de análisis con IA por ahora. Intenta de nuevo más tarde (en unos minutos u horas).", en: "The AI analysis limit was reached for now. Try again later (in a few minutes or hours).", pt: "O limite de análises com IA foi atingido por agora. Tente novamente mais tarde (em alguns minutos ou horas).", fr: "La limite d'analyses IA a été atteinte pour le moment. Réessayez plus tard (dans quelques minutes ou heures).", de: "Das Limit für KI-Analysen wurde vorübergehend erreicht. Versuche es später erneut (in ein paar Minuten oder Stunden).", zh: "AI 分析次数已达上限，请稍后再试（几分钟或几小时后）。", it: "Il limite di analisi IA è stato raggiunto per ora. Riprova più tardi (tra qualche minuto o ora)." },
  // Groq renueva su catálogo seguido: cuando el modelo configurado
  // desaparece, esto NO se arregla reintentando ni esperando, se
  // arregla cambiando una variable de entorno. Merece su propio texto.
  modelo_invalido: { es: "El modelo de IA configurado ya no está disponible. Revisa Configuración → Ayuda → Probar la IA para ver cuál usar.", en: "The configured AI model is no longer available. Check Settings → Help → Test the AI to see which one to use.", pt: "O modelo de IA configurado já não está disponível. Veja Configurações → Ajuda → Testar a IA para saber qual usar.", fr: "Le modèle d'IA configuré n'est plus disponible. Voyez Configuration → Aide → Tester l'IA pour savoir lequel utiliser.", de: "Das eingestellte KI-Modell ist nicht mehr verfügbar. Schau unter Einstellungen → Hilfe → KI testen, welches du nehmen kannst.", zh: "配置的 AI 模型已不可用。请到 设置 → 帮助 → 测试 AI 查看该用哪一个。", it: "Il modello IA configurato non è più disponibile. Guarda Configurazione → Aiuto → Prova l'IA per sapere quale usare." },
  configuracion_invalida: { es: "El análisis con IA no está disponible en este momento. Contacta a soporte.", en: "AI analysis isn't available right now. Contact support.", pt: "A análise com IA não está disponível no momento. Entre em contato com o suporte.", fr: "L'analyse IA n'est pas disponible pour le moment. Contactez le support.", de: "Die KI-Analyse ist derzeit nicht verfügbar. Wende dich an den Support.", zh: "AI 分析目前不可用，请联系支持团队。", it: "L'analisi IA non è disponibile al momento. Contatta l'assistenza." },
};

function mensaje(clave: keyof typeof MENSAJES, idioma: string) {
  return MENSAJES[clave][idioma] ?? MENSAJES[clave].es;
}

export async function POST(request: Request) {
  const user = await verificarUsuarioApi(request);

  if (!user) {
    return NextResponse.json({ error: mensaje("no_autenticado", "es") }, { status: 401 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: mensaje("cuerpo_invalido", "es") }, { status: 400 });
  }

  const { imagenBase64, mimeType, idioma: idiomaBruto, categoriasExistentes: categoriasBrutas } =
    (cuerpo ?? {}) as {
      imagenBase64?: unknown;
      mimeType?: unknown;
      idioma?: unknown;
      categoriasExistentes?: unknown;
    };

  const idioma = typeof idiomaBruto === "string" ? idiomaBruto : "es";

  // Tope de 30: es solo una pista de estilo para el prompt, no hace
  // falta (ni conviene, por tamaño del prompt) mandar el catálogo
  // completo de categorías de negocios con cientos de ellas.
  const categoriasExistentes = Array.isArray(categoriasBrutas)
    ? categoriasBrutas.filter((c): c is string => typeof c === "string" && !!c.trim()).slice(0, 30)
    : [];

  if (typeof imagenBase64 !== "string" || !imagenBase64) {
    return NextResponse.json({ error: mensaje("falta_imagen", idioma) }, { status: 400 });
  }

  if (typeof mimeType !== "string" || !TIPOS_PERMITIDOS.has(mimeType)) {
    return NextResponse.json({ error: mensaje("tipo_no_soportado", idioma) }, { status: 400 });
  }

  if (imagenBase64.length > TAMANO_MAXIMO_BASE64) {
    return NextResponse.json({ error: mensaje("imagen_muy_grande", idioma) }, { status: 400 });
  }

  // Quién va a atender esta foto se decide ANTES del try, para poder
  // nombrarlo tanto en el log del servidor como en el mensaje que ve la
  // persona. Sin esto, "no se pudo analizar la imagen" no distingue si
  // falló Google, falló Groq, o ni siquiera se llegó a preguntar — y
  // adivinar eso ha costado ya varias rondas.
  const porGoogle = hayGoogleAI();
  const proveedor = porGoogle ? "Google AI" : "Groq";

  // El nombre del proveedor NO se traduce (es un nombre propio) y va
  // entre paréntesis al final del mensaje traducido.
  const fallo = (clave: keyof typeof MENSAJES, status: number) =>
    NextResponse.json({ error: `${mensaje(clave, idioma)} (${proveedor})`, proveedor }, { status });

  try {
    // Las FOTOS las atiende Google cuando su llave está puesta, al revés
    // que el texto (chat y vendedor), que prefiere Groq.
    //
    // No es capricho: la capa gratuita de Groq es excelente para texto,
    // pero su catálogo de modelos que saben VER es corto y rota seguido,
    // así que el análisis de fotos se rompía cada vez que retiraban uno.
    // Gemini lleva la visión en el modelo por defecto y no hay que
    // perseguir identificadores.
    //
    // Si no hay llave de Google, se intenta con Groq igual: quien tenga
    // un modelo de visión que le funcione (GROQ_MODEL_VISION) sigue como
    // estaba, sin tener que abrir una cuenta más.
    const resultado = porGoogle
      ? await analizarImagenProducto(imagenBase64, mimeType, idioma, categoriasExistentes)
      : await analizarImagenProductoGroq(imagenBase64, mimeType, idioma, categoriasExistentes);

    return NextResponse.json(resultado);
  } catch (error) {
    // El detalle técnico (a veces en inglés, a veces mencionando la
    // API de Google directamente) queda solo en los logs del
    // servidor — al usuario final le llega un mensaje genérico y
    // traducido, no el texto crudo del proveedor.
    console.error(`Analizar producto (${proveedor}):`, error);

    // Los dos proveedores lanzan un error con .status, así que el
    // mismo manejo (429 = sin cuota, 401/403 = mal configurado)
    // sirve para ambos sin duplicarlo.
    if (error instanceof ErrorGoogleAI || error instanceof ErrorGroq) {
      if (error.status === 429) {
        return fallo("cuota_excedida", 429);
      }
      // Un modelo retirado devuelve 404, o un 400 que lo menciona. Es el
      // fallo más común con Groq, que renueva su catálogo seguido, y
      // decirle a la persona "intenta de nuevo en un momento" la manda a
      // reintentar algo que no va a funcionar nunca: hay que cambiar la
      // variable de entorno. Ya se distinguía en el diagnóstico; faltaba
      // aquí, que es donde de verdad se topa con ello.
      if (
        error.status === 404 ||
        (error.status === 400 && /model|decommission|not found/i.test(error.message))
      ) {
        return fallo("modelo_invalido", 500);
      }

      // 402 es "hace falta pagar" (plan agotado). Va con los de
      // configuración y no con los transitorios porque reintentar no lo
      // arregla. Ojo: en la capa gratuita de Groq lo normal NO es este,
      // es el 429 de arriba — ahí sí conviene esperar y reintentar.
      if (error.status === 401 || error.status === 402 || error.status === 403) {
        return fallo("configuracion_invalida", 500);
      }
    }

    return fallo("fallo_analisis", 500);
  }
}
