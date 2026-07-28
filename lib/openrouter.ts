// Cliente para OpenRouter (chat). Uso EXCLUSIVO en código de servidor
// (app/api/**) — OPENROUTER_API_KEY nunca debe llegar al navegador.
//
// Es lo que convierte al Asistente en una IA de verdad en vez de un
// motor de reglas: aquí la respuesta la escribe un modelo, no una tabla
// de palabras clave. El motor de reglas sigue existiendo y se usa como
// respaldo cuando esto falla (ver app/asistente/page.tsx).

// Barato, rápido y bueno en español, que es lo que pide este caso: un
// mostrador preguntando cosas cortas muchas veces al día. Se puede
// cambiar sin tocar código con OPENROUTER_MODEL.
const MODELO_POR_DEFECTO = "anthropic/claude-3.5-haiku";

// Un asistente de negocio no necesita ensayos: respuestas largas
// cuestan más, tardan más y se leen peor en un celular tras el
// mostrador.
const MAX_TOKENS_RESPUESTA = 700;

const NOMBRE_IDIOMA: Record<string, string> = {
  es: "español",
  en: "inglés",
  pt: "portugués",
  fr: "francés",
  de: "alemán",
  zh: "chino",
  it: "italiano",
};

export interface MensajeChat {
  rol: "usuario" | "asistente";
  texto: string;
}

// Resumen real del negocio que se le da al modelo como contexto. Sin
// esto respondería bien de negocio en general pero no podría decir una
// sola cifra del negocio de quien pregunta, que es la mitad del valor.
export interface ContextoNegocio {
  nombreNegocio: string | null;
  moneda: string;
  productosActivos: number;
  valorInventario: number;
  agotados: string[];
  bajoStock: string[];
  ventasHoy: number;
  ventasSemana: number;
  ventasMes: number;
  productoTop: string | null;
  mejorCliente: string | null;
}

export class ErrorOpenRouter extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ErrorOpenRouter";
    this.status = status;
  }
}

function listaCorta(nombres: string[], maximo = 8): string {
  if (nombres.length === 0) return "ninguno";
  const visibles = nombres.slice(0, maximo).join(", ");
  return nombres.length > maximo ? `${visibles} (y ${nombres.length - maximo} más)` : visibles;
}

function construirSistema(contexto: ContextoNegocio, idioma: string): string {
  const idiomaTexto = NOMBRE_IDIOMA[idioma] ?? "español";
  const negocio = contexto.nombreNegocio?.trim() || "el negocio";
  const m = contexto.moneda;

  return [
    `Eres el Asistente de CoreStock, un sistema de inventario y punto de venta para negocios pequeños. Hablas con la persona dueña de ${negocio}.`,
    "",
    `Responde SIEMPRE en ${idiomaTexto}, aunque la pregunta venga en otro idioma.`,
    "",
    "CÓMO RESPONDES:",
    "- Directo y concreto. Nada de introducciones ni de repetir la pregunta.",
    "- Corto: 3 a 6 líneas normalmente. Solo te extiendes si de verdad hace falta.",
    "- Puedes usar **negritas** y viñetas con •. Nada de tablas ni de encabezados de markdown.",
    "- Tuteas, en tono de alguien que sabe del tema y habla claro, sin palabras rebuscadas.",
    "- Si te preguntan algo que no tiene nada que ver con el negocio, contéstalo igual y con gusto. No eres solo un asistente de inventario.",
    "",
    "SOBRE LOS NÚMEROS DE ESTE NEGOCIO:",
    "- Los datos de abajo son reales y de hoy. Úsalos cuando pregunten por su negocio.",
    "- NUNCA inventes una cifra que no esté abajo. Si te preguntan algo que los datos no cubren (por ejemplo el detalle de un producto concreto), dilo y di en qué pantalla de CoreStock se ve.",
    "- Si un dato está en cero, puede ser que de verdad sea cero o que aún no lo estén registrando. Menciónalo como posibilidad en vez de dar por hecho que el negocio va mal.",
    "",
    "DATOS ACTUALES:",
    `- Productos activos: ${contexto.productosActivos}`,
    `- Valor del inventario: ${m}${contexto.valorInventario.toFixed(2)}`,
    `- Ventas de hoy: ${m}${contexto.ventasHoy.toFixed(2)}`,
    `- Ventas de los últimos 7 días: ${m}${contexto.ventasSemana.toFixed(2)}`,
    `- Ventas de los últimos 30 días: ${m}${contexto.ventasMes.toFixed(2)}`,
    `- Producto más vendido (30 días): ${contexto.productoTop ?? "todavía no hay ventas"}`,
    `- Mejor cliente (30 días): ${contexto.mejorCliente ?? "todavía no hay ventas con cliente"}`,
    `- Productos agotados: ${listaCorta(contexto.agotados)}`,
    `- Productos por debajo del stock mínimo: ${listaCorta(contexto.bajoStock)}`,
    "",
    "LÍMITES:",
    "- No puedes registrar ventas, cambiar precios ni modificar nada. Solo informas y aconsejas. Si te piden hacer algo, explica en qué pantalla se hace.",
    "- En temas de impuestos, contratos o salud, da la orientación general que sepas y di con claridad cuándo conviene consultar a un profesional.",
  ].join("\n");
}

export async function generarRespuestaAsistente(
  pregunta: string,
  historial: MensajeChat[],
  contexto: ContextoNegocio,
  idioma: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    // 401 y no 500: no es una falla transitoria, reintentar nunca lo va
    // a arreglar. Quien llama lo usa para caer al motor de reglas sin
    // molestar a la persona con un error.
    throw new ErrorOpenRouter("Falta configurar OPENROUTER_API_KEY en el servidor.", 401);
  }

  const modelo = process.env.OPENROUTER_MODEL || MODELO_POR_DEFECTO;

  const mensajes = [
    { role: "system", content: construirSistema(contexto, idioma) },
    ...historial.map((m) => ({
      role: m.rol === "usuario" ? "user" : "assistant",
      content: m.texto,
    })),
    { role: "user", content: pregunta },
  ];

  // Sin plazo, una respuesta lenta deja la pantalla colgada y en un
  // host serverless consume el tiempo de la función hasta que la corta
  // de golpe, sin dar oportunidad de caer al respaldo.
  const control = new AbortController();
  const plazo = setTimeout(() => control.abort(), 30000);

  let respuesta: Response;

  try {
    respuesta = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // OpenRouter los usa para atribuir el tráfico. No son secretos.
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://corestock.app",
        "X-Title": "CoreStock",
      },
      body: JSON.stringify({
        model: modelo,
        messages: mensajes,
        max_tokens: MAX_TOKENS_RESPUESTA,
        temperature: 0.6,
      }),
      signal: control.signal,
    });
  } finally {
    clearTimeout(plazo);
  }

  if (!respuesta.ok) {
    let detalle = `HTTP ${respuesta.status}`;
    try {
      const cuerpo = await respuesta.json();
      detalle = cuerpo?.error?.message || detalle;
    } catch {
      // sin cuerpo JSON legible, se deja el detalle genérico
    }
    throw new ErrorOpenRouter(detalle, respuesta.status);
  }

  const datos = await respuesta.json();

  // OpenRouter puede devolver 200 con un error adentro (por ejemplo
  // cuando el modelo elegido no existe), así que un status 200 no basta
  // para dar la respuesta por buena.
  if (datos?.error) {
    throw new ErrorOpenRouter(datos.error.message || "Error de OpenRouter.", 502);
  }

  const texto = datos?.choices?.[0]?.message?.content;

  if (typeof texto !== "string" || !texto.trim()) {
    throw new ErrorOpenRouter("OpenRouter no devolvió una respuesta utilizable.", 502);
  }

  return texto.trim();
}
