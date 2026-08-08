import { NextResponse } from "next/server";
import { verificarUsuarioApi } from "../../../../lib/verificarUsuarioApi";
import { generarModulosRecomendados, ErrorGoogleAI } from "../../../../lib/googleAI";
import { generarModulosRecomendadosGroq, ErrorGroq, hayGroq } from "../../../../lib/groq";
import { extraerHrefsRecomendados, ModuloCatalogo } from "../../../../lib/promptsIA";
import { MODULOS_PERSONALIZABLES } from "../../../../lib/tiposNegocio";
import { excedeLimiteIntentos } from "../../../../lib/rateLimit";
import { traducir, Idioma } from "../../../../lib/i18n";

// Elegir el tipo de negocio no es algo que se repita seguido (al
// registrarse, o alguna vez después desde Configuración) — un tope
// bajo alcanza de sobra y evita que alguien lo dispare en bucle.
const MAX_INTENTOS_POR_HORA = 15;
const VENTANA_MS = 60 * 60 * 1000;

const MENSAJES: Record<string, Record<string, string>> = {
  no_autenticado: { es: "No autenticado.", en: "Not authenticated.", pt: "Não autenticado.", fr: "Non authentifié.", de: "Nicht authentifiziert.", zh: "未认证。", it: "Non autenticato." },
  cuerpo_invalido: { es: "Cuerpo de la solicitud inválido.", en: "Invalid request body.", pt: "Corpo da solicitação inválido.", fr: "Corps de la requête invalide.", de: "Ungültiger Anfragetext.", zh: "请求正文无效。", it: "Corpo della richiesta non valido." },
  limite_propio: { es: "Espera un momento antes de volver a intentarlo.", en: "Wait a moment before trying again.", pt: "Espere um momento antes de tentar novamente.", fr: "Attendez un instant avant de réessayer.", de: "Warte einen Moment, bevor du es erneut versuchst.", zh: "请稍等片刻再试。", it: "Aspetta un momento prima di riprovare." },
  algo_salio_mal: { es: "Ups, algo salió mal. Inténtalo de nuevo en un momento.", en: "Oops, something went wrong. Try again in a moment.", pt: "Ops, algo deu errado. Tente novamente em instantes.", fr: "Oups, quelque chose s'est mal passé. Réessayez dans un instant.", de: "Ups, da ist etwas schiefgelaufen. Versuche es gleich noch einmal.", zh: "哎呀，出了点问题。请稍后再试。", it: "Ops, qualcosa è andato storto. Riprova tra un momento." },
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

  const { descripcion, idioma: idiomaBruto } = (cuerpo ?? {}) as {
    descripcion?: unknown;
    idioma?: unknown;
  };

  const idioma = typeof idiomaBruto === "string" ? idiomaBruto : "es";

  if (typeof descripcion !== "string" || !descripcion.trim()) {
    return NextResponse.json({ error: mensaje("cuerpo_invalido", idioma) }, { status: 400 });
  }

  if (excedeLimiteIntentos(`recomendar-modulos:${user.id}`, MAX_INTENTOS_POR_HORA, VENTANA_MS)) {
    return NextResponse.json({ error: mensaje("limite_propio", idioma) }, { status: 429 });
  }

  // El catálogo que se le ofrece a la IA, ya traducido al idioma de la
  // cuenta — mismo MODULOS_PERSONALIZABLES que usa la grilla de
  // checkboxes de Configuración > Personalización, para que la IA
  // nunca pueda "recomendar" algo que esa pantalla ni siquiera muestra.
  const catalogo: ModuloCatalogo[] = MODULOS_PERSONALIZABLES.map((m) => ({
    href: m.href,
    nombre: traducir(m.claveNombre, idioma as Idioma),
    // claveNombre siempre es "sidebar.xxx" — "xxx.subtitulo" es la
    // descripción de una línea que ese módulo ya muestra en su propio
    // EncabezadoModulo, así que no hay que inventar una nueva.
    descripcion: traducir(`${m.claveNombre.replace(/^sidebar\./, "")}.subtitulo`, idioma as Idioma),
  }));
  const hrefsValidos = catalogo.map((m) => m.href);

  try {
    const textoIA = hayGroq()
      ? await generarModulosRecomendadosGroq(descripcion.trim(), catalogo)
      : await generarModulosRecomendados(descripcion.trim(), catalogo);

    const hrefs = extraerHrefsRecomendados(textoIA, hrefsValidos);

    return NextResponse.json({ hrefs });
  } catch (error) {
    console.error("Recomendar módulos:", error);

    const limite =
      (error instanceof ErrorGoogleAI || error instanceof ErrorGroq) && error.status === 429;

    return limite
      ? NextResponse.json({ error: mensaje("limite_propio", idioma) }, { status: 429 })
      : NextResponse.json({ error: mensaje("algo_salio_mal", idioma) }, { status: 500 });
  }
}
