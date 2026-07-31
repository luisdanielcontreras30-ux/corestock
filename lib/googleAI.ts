// Cliente para la API de Google AI Studio (Gemini). Uso EXCLUSIVO en
// código de servidor (app/api/**) — GOOGLE_AI_API_KEY nunca debe
// exponerse al navegador.

import {
  construirPromptProducto,
  construirPromptVendedor,
  construirPromptMensajeCliente,
  construirPromptMensajeProveedor,
  extraerResultadoProducto,
  ResultadoAnalisisProducto,
  ProductoParaVendedor,
  DatosAnalisisEntidad,
} from "./promptsIA";

// Los prompts y la reparación del JSON que devuelve el modelo viven en
// lib/promptsIA.ts: son idénticos para Google y para Groq, y
// tenerlos duplicados garantizaba que un arreglo se aplicara en uno
// solo de los dos.
export type { ResultadoAnalisisProducto, ProductoParaVendedor };

const MODELO_POR_DEFECTO = "gemini-flash-latest";

// true cuando el servidor tiene con qué hablarle a Google. Las rutas lo
// usan para elegir proveedor sin tener que provocar un error primero.
export function hayGoogleAI(): boolean {
  return !!process.env.GOOGLE_AI_API_KEY;
}

// Igual que en lib/groq.ts: el nombre del modelo se resuelve en UN solo
// sitio para que el diagnóstico de Configuración → Ayuda no pueda
// nombrar uno distinto del que se usa de verdad.
export function modeloGoogleEnUso(): { modelo: string; porDefecto: boolean } {
  const configurado = process.env.GOOGLE_AI_MODEL;
  return { modelo: configurado || MODELO_POR_DEFECTO, porDefecto: !configurado };
}

// Lleva el status HTTP de la respuesta de Google AI para que la ruta
// (route.ts) pueda distinguir "sin cuota"/"clave inválida" — errores
// que NO se van a resolver solos reintentando más tarde — de una
// falla transitoria real, en vez de mostrar siempre el mismo "intenta
// de nuevo" genérico incluso cuando reintentar nunca va a funcionar.
export class ErrorGoogleAI extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ErrorGoogleAI";
    this.status = status;
  }
}

// Google devuelve 400 (no 401/403) cuando la API key está mal formada
// o revocada — "API key not valid. Please pass a valid API key." — así
// que sin este chequeo ese caso caía en el mismo status 400 que
// cualquier otro request mal formado, y el usuario final recibía el
// mensaje genérico de "intenta de nuevo" para un problema que
// reintentar nunca iba a arreglar.
async function errorDesdeRespuesta(respuesta: Response): Promise<ErrorGoogleAI> {
  let detalle = `HTTP ${respuesta.status}`;
  try {
    const cuerpo = await respuesta.json();
    detalle = cuerpo?.error?.message || detalle;
  } catch {
    // sin cuerpo JSON legible, se deja el detalle genérico
  }

  const esClaveInvalida = respuesta.status === 400 && /api key/i.test(detalle);
  return new ErrorGoogleAI(detalle, esClaveInvalida ? 401 : respuesta.status);
}

// Ajustes de generationConfig que son OPTIMIZACIONES, no requisitos:
//
// - thinkingConfig.thinkingBudget: 0 apaga el razonamiento para ahorrar
//   tokens y tiempo. Los modelos Gemini recientes (a los que apunta hoy
//   el alias gemini-flash-latest) NO dejan apagarlo y rechazan la
//   petición entera con "Request contains an invalid argument".
// - responseMimeType: "application/json" pide la respuesta ya en JSON.
//   No todos los modelos lo aceptan, y no hace falta: quien parsea
//   (extraerResultadoProducto) ya sabe rescatar el JSON de un texto
//   suelto, que es justo para lo que se escribió.
//
// Perder cualquiera de las dos cuesta unos tokens; que la petición falle
// cuesta la función entera. Por eso, ante un 400 de "argumento
// inválido", se reintenta UNA vez sin ellas en vez de rendirse: así un
// modelo nuevo funciona sin que nadie tenga que averiguar cuál de los
// dos parámetros le molestaba.
const AJUSTES_PRESCINDIBLES = ["thinkingConfig", "responseMimeType"];

// Modelos que ya demostraron rechazarlos. Sin esta memoria, CADA
// análisis gastaría dos llamadas: una condenada a fallar y el reintento
// bueno. En la capa gratuita, donde el límite se cuenta por peticiones
// por minuto, eso significa chocar con el 429 al doble de velocidad —
// analizar dos fotos seguidas bastaba para quedarse bloqueado.
//
// Vive en memoria del proceso: si el servidor se reinicia se vuelve a
// aprender con un solo reintento, que es exactamente el comportamiento
// deseado si algún día Google cambia lo que acepta.
const modelosQueRechazanAjustes = new Set<string>();

function sinAjustesPrescindibles(
  generationConfig: Record<string, unknown>
): Record<string, unknown> | null {
  const sobrantes = AJUSTES_PRESCINDIBLES.filter((clave) => clave in generationConfig);
  if (sobrantes.length === 0) return null;

  const reducido = { ...generationConfig };
  for (const clave of sobrantes) delete reducido[clave];
  return reducido;
}

// Núcleo compartido: manda las partes del mensaje y devuelve el texto.
// Todo lo delicado (plazo, respuesta vacía, errores) vive aquí una sola
// vez, igual que pedirTexto() en lib/groq.ts.
async function pedirTexto(
  partes: unknown[],
  generationConfig: Record<string, unknown>,
  plazoMs: number
): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    // Mismo tratamiento que una clave inválida (401 de la API): no es
    // una falla transitoria, reintentar nunca lo va a arreglar.
    throw new ErrorGoogleAI("Falta configurar GOOGLE_AI_API_KEY en el servidor.", 401);
  }

  const { modelo } = modeloGoogleEnUso();

  async function pedirUnaVez(config: Record<string, unknown>): Promise<Response> {
    // Sin plazo, una respuesta lenta deja la pantalla colgada y en un
    // host serverless se come el tiempo de la función hasta que la
    // cortan de golpe. Groq ya lo tenía; aquí faltaba, y ahora que
    // Google es quien atiende las fotos importa mucho más.
    const control = new AbortController();
    const plazo = setTimeout(() => control.abort(), plazoMs);

    try {
      return await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: partes }], generationConfig: config }),
          signal: control.signal,
        }
      );
    } finally {
      clearTimeout(plazo);
    }
  }

  // Si este modelo ya rechazó los ajustes antes, se va directo a la
  // versión que sí funciona en vez de repetir la llamada condenada.
  const yaSabemos = modelosQueRechazanAjustes.has(modelo);
  const configInicial = yaSabemos
    ? sinAjustesPrescindibles(generationConfig) ?? generationConfig
    : generationConfig;

  let respuesta = await pedirUnaVez(configInicial);

  if (!yaSabemos && respuesta.status === 400) {
    // El cuerpo solo se puede leer una vez, así que se clona antes de
    // mirarlo: si no es este caso, hay que poder construir el error
    // normal con el cuerpo intacto.
    const error = await errorDesdeRespuesta(respuesta.clone());
    const reducido = sinAjustesPrescindibles(generationConfig);

    if (reducido && /invalid argument|thinking|not supported/i.test(error.message)) {
      console.warn(
        `Google AI rechazó los ajustes opcionales (${error.message}). Se reintenta sin ellos.`
      );
      respuesta = await pedirUnaVez(reducido);

      // Solo se apunta si el reintento SÍ funcionó. Si falla también,
      // los ajustes no eran el problema y recordarlo sería aprender algo
      // falso: se seguirían mandando peticiones capadas para siempre.
      if (respuesta.ok) modelosQueRechazanAjustes.add(modelo);
    }
  }

  if (!respuesta.ok) {
    throw await errorDesdeRespuesta(respuesta);
  }

  const datos = await respuesta.json();
  const texto = datos?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof texto !== "string" || !texto.trim()) {
    throw new ErrorGoogleAI("Google AI no devolvió una respuesta utilizable.", 502);
  }

  return texto.trim();
}

export async function analizarImagenProducto(
  imagenBase64: string,
  mimeType: string,
  idioma: string,
  categoriasExistentes: string[] = []
): Promise<ResultadoAnalisisProducto> {
  const texto = await pedirTexto(
    [
      { text: construirPromptProducto(idioma, categoriasExistentes) },
      { inline_data: { mime_type: mimeType, data: imagenBase64 } },
    ],
    {
      temperature: 0.4,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
    },
    45000
  );

  return extraerResultadoProducto(texto);
}

// Lista los modelos que la cuenta tiene disponibles AHORA, preguntándole
// a Google. Es la única fuente que no envejece: cualquier lista escrita
// a mano en el código o en la documentación queda vieja en cuanto Google
// saca una versión nueva.
//
// Hace falta porque el nombre COMERCIAL que se ve en AI Studio ("Gemini
// 3.6 Flash") no es el identificador que pide la API — poner el nombre
// bonito en GOOGLE_AI_MODEL da un 404 y parece que la llave está mal.
//
// Se filtran los que saben responder contenido (generateContent): el
// resto de la lista son modelos de embeddings y similares, que aquí no
// sirven para nada y solo estorbarían al elegir.
//
// Devuelve [] si algo falla: es información de apoyo, y no vale la pena
// que un fallo aquí tumbe el diagnóstico entero, que es lo importante.
export async function listarModelosGoogleAI(): Promise<string[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return [];

  const control = new AbortController();
  const plazo = setTimeout(() => control.abort(), 15000);

  try {
    const respuesta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`,
      { signal: control.signal }
    );

    if (!respuesta.ok) return [];

    const datos = await respuesta.json();
    const lista = Array.isArray(datos?.models) ? datos.models : [];

    return lista
      .filter((m: { supportedGenerationMethods?: unknown }) =>
        Array.isArray(m?.supportedGenerationMethods)
          ? m.supportedGenerationMethods.includes("generateContent")
          : false
      )
      .map((m: { name?: unknown }) =>
        // Vienen como "models/gemini-2.5-flash"; en la variable de
        // entorno va solo la parte de después de la barra.
        typeof m?.name === "string" ? m.name.replace(/^models\//, "") : null
      )
      .filter((id: string | null): id is string => !!id)
      .sort();
  } catch {
    return [];
  } finally {
    clearTimeout(plazo);
  }
}

// Prueba mínima de que el modelo acepta imágenes, para el diagnóstico de
// Configuración → Ayuda. Deliberadamente NO usa analizarImagenProducto:
// esa exige que la respuesta sea el JSON del catálogo, y ante un pixel
// transparente un modelo perfectamente sano puede contestar cualquier
// cosa. Aquí solo importa que la llamada no reviente.
export async function probarVisionGoogleAI(): Promise<void> {
  const pixel =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  await pedirTexto(
    [
      { text: "Responde solo: ok" },
      { inline_data: { mime_type: "image/png", data: pixel } },
    ],
    { temperature: 0, maxOutputTokens: 64, thinkingConfig: { thinkingBudget: 0 } },
    30000
  );
}

// "Empleados IA" — Vendedor de WhatsApp (fase 1: solo la lógica que
// genera la respuesta a partir del catálogo real; la conexión con
// WhatsApp de verdad se agrega después). Reusa la misma clave de
// Google AI que el análisis de fotos de producto.
export async function generarRespuestaVendedor(
  pregunta: string,
  productos: ProductoParaVendedor[],
  idioma: string
): Promise<string> {
  return pedirTexto(
    [{ text: construirPromptVendedor(pregunta, productos, idioma) }],
    { temperature: 0.5, thinkingConfig: { thinkingBudget: 0 } },
    30000
  );
}

// Análisis de un cliente o proveedor: un mensaje de WhatsApp sugerido a
// partir de su historial. Devuelve texto plano, no JSON — al ser una
// sola entidad por llamada no hace falta parsear una lista.
export async function generarMensajeCliente(
  datos: DatosAnalisisEntidad,
  nombreNegocio: string | null,
  idioma: string
): Promise<string> {
  return pedirTexto(
    [{ text: construirPromptMensajeCliente(datos, nombreNegocio, idioma) }],
    { temperature: 0.6, thinkingConfig: { thinkingBudget: 0 } },
    30000
  );
}

export async function generarMensajeProveedor(
  datos: DatosAnalisisEntidad,
  nombreNegocio: string | null,
  idioma: string
): Promise<string> {
  return pedirTexto(
    [{ text: construirPromptMensajeProveedor(datos, nombreNegocio, idioma) }],
    { temperature: 0.5, thinkingConfig: { thinkingBudget: 0 } },
    30000
  );
}
