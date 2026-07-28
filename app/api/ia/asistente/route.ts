import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { verificarUsuarioApi } from "../../../../lib/verificarUsuarioApi";
import { excedeLimiteIntentos } from "../../../../lib/rateLimit";
import {
  generarRespuestaAsistente,
  ErrorOpenRouter,
  hayOpenRouter,
  ContextoNegocio,
  MensajeChat,
} from "../../../../lib/openrouter";

const LARGO_MAXIMO_PREGUNTA = 1000;

// Cuántos mensajes previos se le mandan al modelo. Suficiente para que
// "cuéntame más" y "¿y eso cómo lo aplico?" tengan sentido, y acotado
// para que una conversación larga no dispare el costo de cada llamada:
// en un chat se paga TODO el historial en cada mensaje, no solo el
// último.
const MAX_MENSAJES_HISTORIAL = 8;

// Cada llamada cuesta dinero real. Sin tope, una sola pestaña con un
// bucle (o alguien curioso) puede vaciar el saldo de OpenRouter en una
// tarde. El límite es por usuario y por hora.
const MAX_PREGUNTAS_POR_HORA = 60;
const VENTANA_MS = 60 * 60 * 1000;

const MENSAJES: Record<string, Record<string, string>> = {
  no_autenticado: { es: "No autenticado.", en: "Not authenticated.", pt: "Não autenticado.", fr: "Non authentifié.", de: "Nicht authentifiziert.", zh: "未认证。", it: "Non autenticato." },
  cuerpo_invalido: { es: "Cuerpo de la solicitud inválido.", en: "Invalid request body.", pt: "Corpo da solicitação inválido.", fr: "Corps de la requête invalide.", de: "Ungültiger Anfragetext.", zh: "请求正文无效。", it: "Corpo della richiesta non valido." },
  falta_pregunta: { es: "Escribe una pregunta.", en: "Type a question.", pt: "Digite uma pergunta.", fr: "Saisissez une question.", de: "Gib eine Frage ein.", zh: "请输入问题。", it: "Scrivi una domanda." },
  limite_propio: { es: "Hiciste muchas preguntas seguidas. Espera un momento antes de continuar.", en: "You've asked a lot of questions in a row. Wait a moment before continuing.", pt: "Você fez muitas perguntas seguidas. Espere um momento antes de continuar.", fr: "Vous avez posé beaucoup de questions d'affilée. Attendez un instant avant de continuer.", de: "Du hast viele Fragen hintereinander gestellt. Warte einen Moment.", zh: "你连续提问太多了，请稍等片刻再继续。", it: "Hai fatto molte domande di seguito. Aspetta un momento prima di continuare." },
};

function mensaje(clave: keyof typeof MENSAJES, idioma: string) {
  return MENSAJES[clave][idioma] ?? MENSAJES[clave].es;
}

function inicioDeHoy(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function haceDias(dias: number): string {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
}

interface FilaProducto {
  nombre: string;
  stock: number;
  costo: number | null;
  stock_minimo: number | null;
}

interface FilaVenta {
  fecha: string;
  producto: string | null;
  total: number;
  cliente_id: number | null;
}

// Arma el resumen que va como contexto al modelo. Todo sale de la base
// con el JWT de quien pregunta, así que RLS decide qué puede ver — un
// miembro del equipo sin permiso de ver ventas no se las lleva por aquí.
async function construirContexto(
  supabase: SupabaseClient
): Promise<ContextoNegocio> {
  const [
    { data: config },
    { data: productos },
    { data: ventas },
    { data: clientes },
  ] = await Promise.all([
    supabase.from("empresa_config").select("nombre_negocio").maybeSingle(),
    supabase.from("productos").select("nombre, stock, costo, stock_minimo").eq("activo", true),
    supabase.from("ventas").select("fecha, producto, total, cliente_id").gte("fecha", haceDias(30)),
    supabase.from("clientes").select("id, nombre"),
  ]);

  const listaProductos = (productos ?? []) as unknown as FilaProducto[];
  const listaVentas = (ventas ?? []) as unknown as FilaVenta[];
  const nombreCliente = new Map<number, string>(
    ((clientes ?? []) as unknown as { id: number; nombre: string }[]).map((c) => [c.id, c.nombre])
  );

  const desdeHoy = inicioDeHoy();
  const desdeSemana = haceDias(7);

  let ventasHoy = 0;
  let ventasSemana = 0;
  let ventasMes = 0;

  const porProducto = new Map<string, number>();
  const porCliente = new Map<number, number>();

  for (const venta of listaVentas) {
    const total = Number(venta.total) || 0;
    ventasMes += total;
    if (venta.fecha >= desdeSemana) ventasSemana += total;
    if (venta.fecha >= desdeHoy) ventasHoy += total;

    if (venta.producto) {
      porProducto.set(venta.producto, (porProducto.get(venta.producto) ?? 0) + total);
    }
    if (venta.cliente_id !== null) {
      porCliente.set(venta.cliente_id, (porCliente.get(venta.cliente_id) ?? 0) + total);
    }
  }

  function mayor<K>(mapa: Map<K, number>): K | null {
    let mejorClave: K | null = null;
    let mejor = -1;
    for (const [clave, valor] of mapa) {
      if (valor > mejor) {
        mejor = valor;
        mejorClave = clave;
      }
    }
    return mejorClave;
  }

  const clienteTop = mayor(porCliente);

  return {
    nombreNegocio: (config as { nombre_negocio?: string } | null)?.nombre_negocio ?? null,
    moneda: "$",
    productosActivos: listaProductos.length,
    valorInventario: listaProductos.reduce(
      (suma, p) => suma + (Number(p.costo) || 0) * (Number(p.stock) || 0),
      0
    ),
    agotados: listaProductos.filter((p) => Number(p.stock) <= 0).map((p) => p.nombre),
    bajoStock: listaProductos
      .filter((p) => {
        const minimo = p.stock_minimo ?? 0;
        return minimo > 0 && Number(p.stock) > 0 && Number(p.stock) <= minimo;
      })
      .map((p) => p.nombre),
    ventasHoy,
    ventasSemana,
    ventasMes,
    productoTop: mayor(porProducto),
    mejorCliente: clienteTop !== null ? nombreCliente.get(clienteTop) ?? null : null,
  };
}


// Diagnóstico de configuración. Existe por un motivo concreto: cuando la
// IA falla, el Asistente cae al motor de reglas EN SILENCIO — que es lo
// correcto para quien está atendiendo el mostrador, pero deja a quien
// instala la app sin ninguna forma de saber si su llave quedó bien
// puesta. Sin esto, "no funciona" y "funciona pero se cayó al respaldo"
// se ven exactamente igual.
//
// Nunca devuelve la llave, solo si existe. El mensaje de error de
// OpenRouter sí se devuelve tal cual (dice cosas como "sin saldo" o
// "modelo no encontrado") porque es justo el dato que hace falta, y va
// detrás de sesión válida como el resto de la ruta.
export async function GET(request: Request) {
  const user = await verificarUsuarioApi(request);

  if (!user) {
    return NextResponse.json({ error: mensaje("no_autenticado", "es") }, { status: 401 });
  }

  const configurada = hayOpenRouter();

  if (!configurada) {
    return NextResponse.json({
      configurada: false,
      motivo: "sin_llave",
      detalle: "No hay OPENROUTER_API_KEY en el servidor.",
    });
  }

  // Con la llave puesta, se prueba de verdad: tener la variable no
  // garantiza que sirva. Es una llamada mínima (dos palabras, 5 tokens)
  // para que comprobar no cueste prácticamente nada.
  try {
    await generarRespuestaAsistente(
      "Responde solo: ok",
      [],
      {
        nombreNegocio: null,
        moneda: "$",
        productosActivos: 0,
        valorInventario: 0,
        agotados: [],
        bajoStock: [],
        ventasHoy: 0,
        ventasSemana: 0,
        ventasMes: 0,
        productoTop: null,
        mejorCliente: null,
      },
      "es"
    );

    return NextResponse.json({
      configurada: true,
      motivo: "ok",
      modelo: process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-haiku (por defecto)",
    });
  } catch (error) {
    const status = error instanceof ErrorOpenRouter ? error.status : 0;
    const detalle = error instanceof Error ? error.message : String(error);

    return NextResponse.json({
      configurada: true,
      motivo:
        status === 401 || status === 403
          ? "llave_invalida"
          : status === 402
            ? "sin_saldo"
            : status === 429
              ? "limite_proveedor"
              : "fallo",
      detalle,
      modelo: process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-haiku (por defecto)",
    });
  }
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

  const {
    pregunta: preguntaBruta,
    idioma: idiomaBruto,
    historial: historialBruto,
  } = (cuerpo ?? {}) as { pregunta?: unknown; idioma?: unknown; historial?: unknown };

  const idioma = typeof idiomaBruto === "string" ? idiomaBruto : "es";

  if (typeof preguntaBruta !== "string" || !preguntaBruta.trim()) {
    return NextResponse.json({ error: mensaje("falta_pregunta", idioma) }, { status: 400 });
  }

  if (excedeLimiteIntentos(`ia-asistente:${user.id}`, MAX_PREGUNTAS_POR_HORA, VENTANA_MS)) {
    return NextResponse.json({ error: mensaje("limite_propio", idioma) }, { status: 429 });
  }

  const pregunta = preguntaBruta.trim().slice(0, LARGO_MAXIMO_PREGUNTA);

  // El historial viene del navegador, así que se valida en vez de
  // confiar: solo los últimos mensajes, solo con los dos roles
  // esperados y recortados de largo.
  const historial: MensajeChat[] = Array.isArray(historialBruto)
    ? historialBruto
        .filter(
          (m): m is { rol: string; texto: string } =>
            !!m &&
            typeof m === "object" &&
            typeof (m as { texto?: unknown }).texto === "string" &&
            ((m as { rol?: unknown }).rol === "usuario" ||
              (m as { rol?: unknown }).rol === "asistente")
        )
        .slice(-MAX_MENSAJES_HISTORIAL)
        .map((m) => ({
          rol: m.rol as "usuario" | "asistente",
          texto: m.texto.slice(0, LARGO_MAXIMO_PREGUNTA),
        }))
    : [];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    return NextResponse.json({ error: "config" }, { status: 503 });
  }

  // Con el JWT de quien pregunta, no con la service_role: la lectura
  // queda sujeta a RLS igual que desde el navegador.
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: request.headers.get("authorization") ?? "" } },
  });

  try {
    const contexto = await construirContexto(supabase);
    const respuesta = await generarRespuestaAsistente(pregunta, historial, contexto, idioma);
    return NextResponse.json({ respuesta });
  } catch (error) {
    console.error("Asistente IA:", error);

    if (error instanceof ErrorOpenRouter) {
      // 503 = "esto no va a funcionar ahora": sin llave, sin saldo o
      // modelo mal configurado. El navegador lo usa como señal para
      // caer al motor de reglas EN SILENCIO, sin enseñar un error:
      // desde el punto de vista de quien pregunta, el asistente
      // simplemente respondió (con menos alcance, pero respondió).
      if (error.status === 401 || error.status === 402 || error.status === 403) {
        return NextResponse.json({ error: "config" }, { status: 503 });
      }
      if (error.status === 429) {
        return NextResponse.json({ error: "config" }, { status: 503 });
      }
    }

    return NextResponse.json({ error: "fallo" }, { status: 503 });
  }
}
