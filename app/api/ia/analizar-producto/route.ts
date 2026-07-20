import { NextResponse } from "next/server";
import { verificarUsuarioApi } from "../../../../lib/verificarUsuarioApi";
import { analizarImagenProducto, ErrorGoogleAI } from "../../../../lib/googleAI";

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

  try {
    const resultado = await analizarImagenProducto(imagenBase64, mimeType, idioma, categoriasExistentes);
    return NextResponse.json(resultado);
  } catch (error) {
    // El detalle técnico (a veces en inglés, a veces mencionando la
    // API de Google directamente) queda solo en los logs del
    // servidor — al usuario final le llega un mensaje genérico y
    // traducido, no el texto crudo del proveedor.
    console.error(error);

    if (error instanceof ErrorGoogleAI) {
      if (error.status === 429) {
        return NextResponse.json({ error: mensaje("cuota_excedida", idioma) }, { status: 429 });
      }
      if (error.status === 401 || error.status === 403) {
        return NextResponse.json({ error: mensaje("configuracion_invalida", idioma) }, { status: 500 });
      }
    }

    return NextResponse.json({ error: mensaje("fallo_analisis", idioma) }, { status: 500 });
  }
}
