import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verificarUsuarioApi } from "../../../../lib/verificarUsuarioApi";
import { generarRespuestaVendedor, ErrorGoogleAI, ProductoParaVendedor } from "../../../../lib/googleAI";
import { generarRespuestaVendedorGroq, ErrorGroq, hayGroq } from "../../../../lib/groq";
import { tieneAccesoBeta } from "../../../../lib/betaAcceso";

// Tope generoso para una pregunta de cliente por WhatsApp — evita
// mandar textos absurdamente largos al prompt sin motivo real.
const LARGO_MAXIMO_PREGUNTA = 500;

const MENSAJES: Record<string, Record<string, string>> = {
  no_autenticado: { es: "No autenticado.", en: "Not authenticated.", pt: "Não autenticado.", fr: "Non authentifié.", de: "Nicht authentifiziert.", zh: "未认证。", it: "Non autenticato." },
  cuerpo_invalido: { es: "Cuerpo de la solicitud inválido.", en: "Invalid request body.", pt: "Corpo da solicitação inválido.", fr: "Corps de la requête invalide.", de: "Ungültiger Anfragetext.", zh: "请求正文无效。", it: "Corpo della richiesta non valido." },
  falta_pregunta: { es: "Escribe una pregunta para probar el vendedor.", en: "Type a question to test the seller.", pt: "Digite uma pergunta para testar o vendedor.", fr: "Saisissez une question pour tester le vendeur.", de: "Gib eine Frage ein, um den Verkäufer zu testen.", zh: "请输入一个问题来测试销售助手。", it: "Scrivi una domanda per testare il venditore." },
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
    return NextResponse.json({ error: mensaje("algo_salio_mal", idioma) }, { status: 500 });
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
    return NextResponse.json({ error: mensaje("algo_salio_mal", idioma) }, { status: 500 });
  }

  try {
    // Se prefiere Groq cuando su llave está puesta: es la que
    // enciende TODAS las funciones de IA de la app con una sola cuenta.
    // Google queda como alternativa para quien ya venía usando su llave
    // de AI Studio.
    const lista = (productos ?? []) as ProductoParaVendedor[];

    const respuestaTexto = hayGroq()
      ? await generarRespuestaVendedorGroq(pregunta, lista, idioma)
      : await generarRespuestaVendedor(pregunta, lista, idioma);

    return NextResponse.json({ respuesta: respuestaTexto });
  } catch (error) {
    // El detalle técnico se queda en el log del servidor, que es donde
    // se arregla. Lo único que cambia para quien pregunta es CUÁNDO
    // volver a intentarlo: si topó con un límite (429) o con otra cosa.
    console.error("Vendedor WhatsApp:", error);

    const limite =
      (error instanceof ErrorGoogleAI || error instanceof ErrorGroq) && error.status === 429;

    return limite
      ? NextResponse.json({ error: mensaje("algo_salio_mal_espera", idioma) }, { status: 429 })
      : NextResponse.json({ error: mensaje("algo_salio_mal", idioma) }, { status: 500 });
  }
}
