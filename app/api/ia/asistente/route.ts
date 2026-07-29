import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { verificarUsuarioApi } from "../../../../lib/verificarUsuarioApi";
import { excedeLimiteIntentos } from "../../../../lib/rateLimit";
import {
  generarRespuestaAsistente,
  probarVisionGroq,
  listarModelosGroq,
  ErrorGroq,
  hayGroq,
  ContextoNegocio,
  MensajeChat,
} from "../../../../lib/groq";

const LARGO_MAXIMO_PREGUNTA = 1000;

// Cuántos mensajes previos se le mandan al modelo. Suficiente para que
// "cuéntame más" y "¿y eso cómo lo aplico?" tengan sentido, y acotado
// para que una conversación larga no dispare el costo de cada llamada:
// en un chat se paga TODO el historial en cada mensaje, no solo el
// último.
const MAX_MENSAJES_HISTORIAL = 8;

// Cada llamada cuesta dinero real. Sin tope, una sola pestaña con un
// bucle (o alguien curioso) puede vaciar el saldo de Groq en una
// tarde. El límite es por usuario y por hora.
const MAX_PREGUNTAS_POR_HORA = 60;
const VENTANA_MS = 60 * 60 * 1000;

// El diagnóstico se limita MUCHO más que una pregunta normal, y no por
// exceso de celo: cada comprobación gasta hasta tres llamadas a Groq
// (texto, visión y la lista de modelos) contra una de una pregunta
// suelta. Sin tope era el punto más caro de toda la app — y el único
// sin límite, porque el que existía solo cubría el POST.
//
// 10 por hora sobra para configurar la llave y comprobar un cambio de
// modelo, que es para lo único que sirve.
const MAX_DIAGNOSTICOS_POR_HORA = 10;

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
    { data: productos, error: errorProductos },
    { data: ventas, error: errorVentas },
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

  // Un error acá NO se convierte en cero. Si la consulta de ventas
  // falla (RLS, permiso, red), mandar ventasHoy: 0 hace que el modelo
  // afirme con total seguridad "hoy no has vendido nada" — una mentira
  // sobre el propio negocio de quien pregunta, que es exactamente lo
  // que este asistente no puede permitirse.
  if (errorProductos) console.error("Asistente IA, inventario:", errorProductos);
  if (errorVentas) console.error("Asistente IA, ventas:", errorVentas);

  return {
    inventarioDisponible: !errorProductos,
    ventasDisponibles: !errorVentas,
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
// Groq sí se devuelve tal cual (dice cosas como "sin saldo" o
// "modelo no encontrado") porque es justo el dato que hace falta, y va
// detrás de sesión válida como el resto de la ruta.
function clasificar(error: unknown): { motivo: string; detalle: string } {
  const status = error instanceof ErrorGroq ? error.status : 0;
  const detalle = error instanceof Error ? error.message : String(error);

  // Un modelo retirado devuelve 404, o un 400 que menciona el modelo.
  // Merece su propio motivo: es el fallo MÁS común con Groq, que renueva
  // su catálogo seguido, y el único que se arregla sin tocar nada más
  // que una variable de entorno. Meterlo en el saco de "falló, intenta
  // de nuevo" manda a la persona a reintentar algo que nunca va a
  // funcionar.
  const pareceModelo =
    status === 404 || (status === 400 && /model|decommission|not found/i.test(detalle));

  if (pareceModelo) return { motivo: "modelo_invalido", detalle };
  if (status === 401 || status === 403) return { motivo: "llave_invalida", detalle };
  if (status === 402) return { motivo: "sin_saldo", detalle };
  if (status === 429) return { motivo: "limite_proveedor", detalle };
  return { motivo: "fallo", detalle };
}

export async function GET(request: Request) {
  const user = await verificarUsuarioApi(request);

  if (!user) {
    return NextResponse.json({ error: mensaje("no_autenticado", "es") }, { status: 401 });
  }

  // Clave propia, separada de la del POST: gastar los diagnósticos no
  // debe dejar a nadie sin poder usar el Asistente, ni al revés.
  if (excedeLimiteIntentos(`ia-diagnostico:${user.id}`, MAX_DIAGNOSTICOS_POR_HORA, VENTANA_MS)) {
    return NextResponse.json(
      { configurada: true, texto: { motivo: "limite_diagnostico" }, vision: { motivo: "limite_diagnostico" } },
      { status: 429 }
    );
  }

  const modeloTexto = process.env.GROQ_MODEL || "llama-3.3-70b-versatile (por defecto)";
  const modeloVision =
    process.env.GROQ_MODELO_VISION || "meta-llama/llama-4-scout-17b-16e-instruct (por defecto)";

  if (!hayGroq()) {
    return NextResponse.json({
      configurada: false,
      texto: { motivo: "sin_llave", modelo: modeloTexto },
      vision: { motivo: "sin_llave", modelo: modeloVision },
    });
  }

  // Se prueban los DOS modelos, por separado y de verdad. Son modelos
  // distintos y fallan por separado: probar solo el de texto es lo que
  // dejaba "el chat funciona pero las fotos no" sin ninguna explicación.
  //
  // En paralelo porque son independientes, y con llamadas mínimas para
  // que comprobar no consuma cuota apreciable.
  const [texto, vision] = await Promise.all([
    generarRespuestaAsistente(
      "Responde solo: ok",
      [],
      {
        // El diagnóstico solo comprueba que el modelo conteste; no le
        // muestra ningún dato del negocio.
        ventasDisponibles: true,
        inventarioDisponible: true,
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
    )
      .then(() => ({ motivo: "ok", modelo: modeloTexto }))
      .catch((error) => ({ ...clasificar(error), modelo: modeloTexto })),

    probarVisionGroq()
      .then(() => ({ motivo: "ok", modelo: modeloVision }))
      .catch((error) => ({ ...clasificar(error), modelo: modeloVision })),
  ]);

  // La lista real solo hace falta cuando hay algo que arreglar. Pedirla
  // siempre sería una llamada de más en el caso normal, que es que todo
  // funcione.
  const algoFallo = texto.motivo !== "ok" || vision.motivo !== "ok";
  const modelosDisponibles = algoFallo ? await listarModelosGroq() : [];

  return NextResponse.json({ configurada: true, texto, vision, modelosDisponibles });
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

    if (error instanceof ErrorGroq) {
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
