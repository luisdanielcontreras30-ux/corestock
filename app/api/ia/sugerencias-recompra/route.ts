import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verificarUsuarioApi } from "../../../../lib/verificarUsuarioApi";
import { generarSugerenciasRecompra, ErrorGoogleAI } from "../../../../lib/googleAI";
import { generarSugerenciasRecompraGroq, ErrorGroq, hayGroq } from "../../../../lib/groq";
import { ClienteFrecuenteInfo } from "../../../../lib/promptsIA";
import { excedeLimiteIntentos } from "../../../../lib/rateLimit";

// Un lote más caro que una pregunta suelta del Asistente (analiza
// varios clientes a la vez), así que el tope es más bajo — 10 por hora
// alcanza de sobra para revisar la lista un par de veces seguidas sin
// dejar la puerta abierta a golpear el botón sin parar.
const MAX_ANALISIS_POR_HORA = 10;
const VENTANA_MS = 60 * 60 * 1000;

// Cuántos clientes como máximo entran al prompt. Es una lista de
// "a quién vale la pena contactar hoy", no el padrón completo — y un
// prompt más corto cuesta menos y tarda menos.
const MAXIMO_CLIENTES = 12;

// Frecuente = ya volvió al menos una vez. Con una sola compra no hay
// patrón que sugerir, todavía es un cliente nuevo.
const MINIMO_COMPRAS = 2;

const MENSAJES: Record<string, Record<string, string>> = {
  no_autenticado: { es: "No autenticado.", en: "Not authenticated.", pt: "Não autenticado.", fr: "Non authentifié.", de: "Nicht authentifiziert.", zh: "未认证。", it: "Non autenticato." },
  limite_propio: { es: "Ya hiciste varios análisis seguidos. Espera un momento antes de repetirlo.", en: "You've run several analyses in a row. Wait a moment before trying again.", pt: "Você já fez várias análises seguidas. Espere um momento antes de repetir.", fr: "Vous avez lancé plusieurs analyses d'affilée. Attendez un instant avant de recommencer.", de: "Du hast bereits mehrere Analysen hintereinander gemacht. Warte einen Moment.", zh: "你已经连续做了好几次分析，请稍等片刻再试。", it: "Hai già eseguito diverse analisi di fila. Aspetta un momento prima di riprovare." },
  algo_salio_mal: { es: "Ups, algo salió mal. Inténtalo de nuevo en un momento.", en: "Oops, something went wrong. Try again in a moment.", pt: "Ops, algo deu errado. Tente novamente em instantes.", fr: "Oups, quelque chose s'est mal passé. Réessayez dans un instant.", de: "Ups, da ist etwas schiefgelaufen. Versuche es gleich noch einmal.", zh: "哎呀，出了点问题。请稍后再试。", it: "Ops, qualcosa è andato storto. Riprova tra un momento." },
  algo_salio_mal_espera: { es: "Ups, algo salió mal. Inténtalo de nuevo en unos minutos.", en: "Oops, something went wrong. Try again in a few minutes.", pt: "Ops, algo deu errado. Tente novamente em alguns minutos.", fr: "Oups, quelque chose s'est mal passé. Réessayez dans quelques minutes.", de: "Ups, da ist etwas schiefgelaufen. Versuche es in ein paar Minuten noch einmal.", zh: "哎呀，出了点问题。请过几分钟再试。", it: "Ops, qualcosa è andato storto. Riprova tra qualche minuto." },
};

function mensaje(clave: keyof typeof MENSAJES, idioma: string) {
  return MENSAJES[clave][idioma] ?? MENSAJES[clave].es;
}

interface ClienteCandidato {
  id: number;
  nombre: string;
  telefono: string | null;
  compras: number;
  productoTop: string | null;
  diasDesdeUltimaCompra: number | null;
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
    cuerpo = {};
  }

  const { idioma: idiomaBruto } = (cuerpo ?? {}) as { idioma?: unknown };
  const idioma = typeof idiomaBruto === "string" ? idiomaBruto : "es";

  if (excedeLimiteIntentos(`recompra:${user.id}`, MAX_ANALISIS_POR_HORA, VENTANA_MS)) {
    return NextResponse.json({ error: mensaje("limite_propio", idioma) }, { status: 429 });
  }

  // Cliente con el JWT de quien pregunta (no la service_role key): la
  // lectura de clientes/ventas queda sujeta a RLS igual que cualquier
  // consulta desde el navegador.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    return NextResponse.json({ error: mensaje("algo_salio_mal", idioma) }, { status: 500 });
  }

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: request.headers.get("authorization") ?? "" } },
  });

  const [{ data: clientes, error: errorClientes }, { data: ventas, error: errorVentas }, { data: config }] =
    await Promise.all([
      supabase.from("clientes").select("id, nombre, telefono"),
      supabase
        .from("ventas")
        .select("cliente_id, producto, fecha")
        .not("cliente_id", "is", null),
      supabase.from("empresa_config").select("nombre_negocio").maybeSingle(),
    ]);

  if (errorClientes) {
    console.error(errorClientes);
    return NextResponse.json({ error: mensaje("algo_salio_mal", idioma) }, { status: 500 });
  }
  if (errorVentas) {
    console.error(errorVentas);
    return NextResponse.json({ error: mensaje("algo_salio_mal", idioma) }, { status: 500 });
  }

  const nombreTelefono = new Map(
    (clientes ?? []).map((c) => [c.id as number, { nombre: c.nombre as string, telefono: c.telefono as string | null }])
  );

  interface Acumulado {
    compras: number;
    porProducto: Map<string, number>;
    ultimaFecha: string | null;
  }

  const porCliente = new Map<number, Acumulado>();

  for (const venta of ventas ?? []) {
    const clienteId = venta.cliente_id as number | null;
    if (clienteId == null) continue;

    const actual = porCliente.get(clienteId) ?? { compras: 0, porProducto: new Map(), ultimaFecha: null };
    actual.compras += 1;

    const producto = (venta.producto as string | null)?.trim();
    if (producto) {
      actual.porProducto.set(producto, (actual.porProducto.get(producto) ?? 0) + 1);
    }

    const fecha = venta.fecha as string;
    if (!actual.ultimaFecha || fecha > actual.ultimaFecha) {
      actual.ultimaFecha = fecha;
    }

    porCliente.set(clienteId, actual);
  }

  const ahora = Date.now();

  const candidatos: ClienteCandidato[] = [];

  for (const [clienteId, datos] of porCliente) {
    if (datos.compras < MINIMO_COMPRAS) continue;

    const identidad = nombreTelefono.get(clienteId);
    if (!identidad || !identidad.telefono) continue; // sin teléfono no hay a quién mandarle el link de WhatsApp

    let productoTop: string | null = null;
    let mejorCuenta = 0;
    for (const [producto, cuenta] of datos.porProducto) {
      if (cuenta > mejorCuenta) {
        mejorCuenta = cuenta;
        productoTop = producto;
      }
    }

    const diasDesdeUltimaCompra = datos.ultimaFecha
      ? Math.max(0, Math.round((ahora - new Date(datos.ultimaFecha).getTime()) / (24 * 60 * 60 * 1000)))
      : null;

    candidatos.push({
      id: clienteId,
      nombre: identidad.nombre,
      telefono: identidad.telefono,
      compras: datos.compras,
      productoTop,
      diasDesdeUltimaCompra,
    });
  }

  candidatos.sort((a, b) => b.compras - a.compras);
  const seleccionados = candidatos.slice(0, MAXIMO_CLIENTES);

  if (seleccionados.length === 0) {
    return NextResponse.json({ sugerencias: [] });
  }

  const nombreNegocio = (config as { nombre_negocio?: string } | null)?.nombre_negocio ?? null;

  const infoParaIA: ClienteFrecuenteInfo[] = seleccionados.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    compras: c.compras,
    productoTop: c.productoTop,
    diasDesdeUltimaCompra: c.diasDesdeUltimaCompra,
  }));

  try {
    // Se prefiere Groq cuando su llave está puesta, igual que el resto
    // de las funciones de texto de la app (ver lib/groq.ts).
    const sugerenciasIA = hayGroq()
      ? await generarSugerenciasRecompraGroq(infoParaIA, nombreNegocio, idioma)
      : await generarSugerenciasRecompra(infoParaIA, nombreNegocio, idioma);

    const mensajePorCliente = new Map(sugerenciasIA.map((s) => [s.clienteId, s.mensaje]));

    // Solo se devuelven los clientes para los que la IA sí devolvió un
    // mensaje utilizable — mostrar una tarjeta sin texto sería peor que
    // no mostrarla.
    const sugerencias = seleccionados
      .map((c) => ({
        clienteId: c.id,
        nombre: c.nombre,
        telefono: c.telefono,
        compras: c.compras,
        productoTop: c.productoTop,
        mensaje: mensajePorCliente.get(c.id) ?? null,
      }))
      .filter((s): s is typeof s & { mensaje: string } => !!s.mensaje);

    return NextResponse.json({ sugerencias });
  } catch (error) {
    console.error("Sugerencias de recompra:", error);

    const limite =
      (error instanceof ErrorGoogleAI || error instanceof ErrorGroq) && error.status === 429;

    return limite
      ? NextResponse.json({ error: mensaje("algo_salio_mal_espera", idioma) }, { status: 429 })
      : NextResponse.json({ error: mensaje("algo_salio_mal", idioma) }, { status: 500 });
  }
}
