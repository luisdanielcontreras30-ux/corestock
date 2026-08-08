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
  // Un solo mensaje para TODO lo que falle del lado de la IA. A quien
  // atiende un negocio no le sirve saber si fue la cuota, el modelo o
  // la configuración: no puede hacer nada con esa información y solo
  // le suena a que la app está rota. El detalle técnico sigue entero
  // en el log del servidor, que es donde se arregla.
  algo_salio_mal: { es: "Ups, algo salió mal. Inténtalo de nuevo en un momento.", en: "Oops, something went wrong. Try again in a moment.", pt: "Ops, algo deu errado. Tente novamente em instantes.", fr: "Oups, quelque chose s'est mal passé. Réessayez dans un instant.", de: "Ups, da ist etwas schiefgelaufen. Versuche es gleich noch einmal.", zh: "哎呀，出了点问题。请稍后再试。", it: "Ops, qualcosa è andato storto. Riprova tra un momento." },
  // Igual de genérico, pero sin invitar a reintentar de inmediato
  // contra un límite que aún no se ha soltado.
  algo_salio_mal_espera: { es: "Ups, algo salió mal. Inténtalo de nuevo en unos minutos.", en: "Oops, something went wrong. Try again in a few minutes.", pt: "Ops, algo deu errado. Tente novamente em alguns minutos.", fr: "Oups, quelque chose s'est mal passé. Réessayez dans quelques minutes.", de: "Ups, da ist etwas schiefgelaufen. Versuche es in ein paar Minuten noch einmal.", zh: "哎呀，出了点问题。请过几分钟再试。", it: "Ops, qualcosa è andato storto. Riprova tra qualche minuto." },
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
  // nombrarlo en el log del servidor. Sin ese dato, un "no se pudo
  // analizar" en los logs no distingue si falló Google, falló Groq o ni
  // siquiera se llegó a preguntar — y adivinar eso costó varias rondas.
  // Al usuario final no se le enseña: no puede hacer nada con ello.
  const porGoogle = hayGoogleAI();
  const proveedor = porGoogle ? "Google AI" : "Groq";

  const fallo = (clave: keyof typeof MENSAJES, status: number) =>
    NextResponse.json({ error: mensaje(clave, idioma) }, { status });

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
    // Todo el detalle técnico (proveedor, modelo, texto crudo del error)
    // se queda AQUÍ, en el log del servidor, que es donde se arregla.
    console.error(`Analizar producto (${proveedor}):`, error);

    // A quien atiende un negocio no le sirve saber si fue la cuota, el
    // modelo retirado o la llave mal puesta: no puede hacer nada con esa
    // información y solo le suena a que la app está rota. Lo único que
    // cambia para esa persona es CUÁNDO volver a intentarlo, y eso solo
    // depende de si se topó con un límite (429) o con cualquier otra
    // cosa. Por eso hay dos mensajes y no cinco.
    const limite =
      (error instanceof ErrorGoogleAI || error instanceof ErrorGroq) && error.status === 429;

    return limite ? fallo("algo_salio_mal_espera", 429) : fallo("algo_salio_mal", 500);
  }
}
