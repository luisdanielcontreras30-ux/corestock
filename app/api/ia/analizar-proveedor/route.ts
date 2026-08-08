import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verificarUsuarioApi } from "../../../../lib/verificarUsuarioApi";
import { generarMensajeProveedor, ErrorGoogleAI } from "../../../../lib/googleAI";
import { generarMensajeProveedorGroq, ErrorGroq, hayGroq } from "../../../../lib/groq";
import { DatosAnalisisEntidad } from "../../../../lib/promptsIA";
import { excedeLimiteIntentos } from "../../../../lib/rateLimit";

// Se analiza un proveedor a la vez, desde su propia tarjeta en
// Proveedores — se puede tocar varias veces seguidas mientras se
// revisa la lista, así que el tope es más generoso que el de un
// análisis por lote.
const MAX_ANALISIS_POR_HORA = 30;
const VENTANA_MS = 60 * 60 * 1000;

const MENSAJES: Record<string, Record<string, string>> = {
  no_autenticado: { es: "No autenticado.", en: "Not authenticated.", pt: "Não autenticado.", fr: "Non authentifié.", de: "Nicht authentifiziert.", zh: "未认证。", it: "Non autenticato." },
  cuerpo_invalido: { es: "Cuerpo de la solicitud inválido.", en: "Invalid request body.", pt: "Corpo da solicitação inválido.", fr: "Corps de la requête invalide.", de: "Ungültiger Anfragetext.", zh: "请求正文无效。", it: "Corpo della richiesta non valido." },
  limite_propio: { es: "Ya analizaste varios proveedores seguidos. Espera un momento antes de continuar.", en: "You've analyzed several suppliers in a row. Wait a moment before continuing.", pt: "Você já analisou vários fornecedores seguidos. Espere um momento antes de continuar.", fr: "Vous avez analysé plusieurs fournisseurs d'affilée. Attendez un instant avant de continuer.", de: "Du hast bereits mehrere Lieferanten hintereinander analysiert. Warte einen Moment.", zh: "你已经连续分析了好几个供应商，请稍等片刻再继续。", it: "Hai già analizzato diversi fornitori di fila. Aspetta un momento prima di continuare." },
  algo_salio_mal: { es: "Ups, algo salió mal. Inténtalo de nuevo en un momento.", en: "Oops, something went wrong. Try again in a moment.", pt: "Ops, algo deu errado. Tente novamente em instantes.", fr: "Oups, quelque chose s'est mal passé. Réessayez dans un instant.", de: "Ups, da ist etwas schiefgelaufen. Versuche es gleich noch einmal.", zh: "哎呀，出了点问题。请稍后再试。", it: "Ops, qualcosa è andato storto. Riprova tra un momento." },
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

  const { proveedorId, idioma: idiomaBruto } = (cuerpo ?? {}) as {
    proveedorId?: unknown;
    idioma?: unknown;
  };

  const idioma = typeof idiomaBruto === "string" ? idiomaBruto : "es";

  if (typeof proveedorId !== "string" || !proveedorId) {
    return NextResponse.json({ error: mensaje("cuerpo_invalido", idioma) }, { status: 400 });
  }

  if (excedeLimiteIntentos(`analizar-proveedor:${user.id}`, MAX_ANALISIS_POR_HORA, VENTANA_MS)) {
    return NextResponse.json({ error: mensaje("limite_propio", idioma) }, { status: 429 });
  }

  // Cliente con el JWT de quien pregunta (no la service_role key): la
  // lectura de proveedores/compras queda sujeta a RLS igual que
  // cualquier consulta desde el navegador.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    return NextResponse.json({ error: mensaje("algo_salio_mal", idioma) }, { status: 500 });
  }

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: request.headers.get("authorization") ?? "" } },
  });

  const [{ data: proveedor, error: errorProveedor }, { data: compras, error: errorCompras }, { data: config }] =
    await Promise.all([
      supabase.from("proveedores").select("nombre, telefono").eq("id", proveedorId).maybeSingle(),
      supabase.from("compras").select("producto, fecha, total").eq("proveedor_id", proveedorId),
      supabase.from("empresa_config").select("nombre_negocio").maybeSingle(),
    ]);

  if (errorProveedor) {
    console.error(errorProveedor);
    return NextResponse.json({ error: mensaje("algo_salio_mal", idioma) }, { status: 500 });
  }
  if (errorCompras) {
    console.error(errorCompras);
    return NextResponse.json({ error: mensaje("algo_salio_mal", idioma) }, { status: 500 });
  }

  // RLS rechazó el id (proveedor de otro negocio) o ya no existe.
  if (!proveedor) {
    return NextResponse.json({ error: mensaje("algo_salio_mal", idioma) }, { status: 404 });
  }

  const lista = compras ?? [];

  if (lista.length === 0) {
    return NextResponse.json({
      compras: 0,
      totalGastado: 0,
      ticketPromedio: 0,
      frecuenciaDias: null,
      prediccionMensual: null,
      productoTop: null,
      diasDesdeUltimaCompra: null,
      mensaje: null,
    });
  }

  let totalGastado = 0;
  let primeraFecha: string | null = null;
  let ultimaFecha: string | null = null;
  const porProducto = new Map<string, number>();

  for (const compra of lista) {
    totalGastado += Number(compra.total) || 0;

    const producto = (compra.producto as string | null)?.trim();
    if (producto) porProducto.set(producto, (porProducto.get(producto) ?? 0) + 1);

    const fecha = compra.fecha as string;
    if (!primeraFecha || fecha < primeraFecha) primeraFecha = fecha;
    if (!ultimaFecha || fecha > ultimaFecha) ultimaFecha = fecha;
  }

  let productoTop: string | null = null;
  let mejorCuenta = 0;
  for (const [producto, cuenta] of porProducto) {
    if (cuenta > mejorCuenta) {
      mejorCuenta = cuenta;
      productoTop = producto;
    }
  }

  const numCompras = lista.length;
  const ticketPromedio = totalGastado / numCompras;

  const diasDesdeUltimaCompra = ultimaFecha
    ? Math.max(0, Math.round((Date.now() - new Date(ultimaFecha).getTime()) / (24 * 60 * 60 * 1000)))
    : null;

  let frecuenciaDias: number | null = null;
  let prediccionMensual: number | null = null;
  if (numCompras > 1 && primeraFecha && ultimaFecha) {
    const spanDias = (new Date(ultimaFecha).getTime() - new Date(primeraFecha).getTime()) / (24 * 60 * 60 * 1000);
    frecuenciaDias = Math.max(1, Math.round(spanDias / (numCompras - 1)));
    prediccionMensual = Math.round((ticketPromedio * 30) / frecuenciaDias);
  }

  const nombreNegocio = (config as { nombre_negocio?: string } | null)?.nombre_negocio ?? null;

  const datosParaIA: DatosAnalisisEntidad = {
    nombre: proveedor.nombre as string,
    compras: numCompras,
    productoTop,
    diasDesdeUltimaCompra,
  };

  try {
    const mensajeIA = hayGroq()
      ? await generarMensajeProveedorGroq(datosParaIA, nombreNegocio, idioma)
      : await generarMensajeProveedor(datosParaIA, nombreNegocio, idioma);

    return NextResponse.json({
      compras: numCompras,
      totalGastado,
      ticketPromedio,
      frecuenciaDias,
      prediccionMensual,
      productoTop,
      diasDesdeUltimaCompra,
      mensaje: mensajeIA,
    });
  } catch (error) {
    console.error("Analizar proveedor:", error);

    const limite =
      (error instanceof ErrorGoogleAI || error instanceof ErrorGroq) && error.status === 429;

    return limite
      ? NextResponse.json({ error: mensaje("algo_salio_mal_espera", idioma) }, { status: 429 })
      : NextResponse.json({ error: mensaje("algo_salio_mal", idioma) }, { status: 500 });
  }
}
