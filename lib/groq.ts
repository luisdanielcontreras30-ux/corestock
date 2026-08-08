import {
  construirPromptProducto,
  construirPromptVendedor,
  construirPromptMensajeCliente,
  construirPromptMensajeProveedor,
  construirPromptRecomendarModulos,
  construirPromptAsistente,
  extraerResultadoProducto,
  ResultadoAnalisisProducto,
  ProductoParaVendedor,
  DatosAnalisisEntidad,
  ModuloCatalogo,
  ContextoNegocio,
} from "./promptsIA";

export type { ContextoNegocio };

// Cliente para Groq (chat). Uso EXCLUSIVO en código de servidor
// (app/api/**) — GROQ_API_KEY nunca debe llegar al navegador.
//
// Es lo que convierte al Asistente en una IA de verdad en vez de un
// motor de reglas: aquí la respuesta la escribe un modelo, no una tabla
// de palabras clave. El motor de reglas sigue existiendo y se usa como
// respaldo cuando esto falla (ver app/asistente/page.tsx).
//
// Groq expone una API compatible con la de OpenAI, así que el cuerpo de
// la petición es el estándar de "chat completions": lo único propio es
// la URL y la llave.

const URL_GROQ = "https://api.groq.com/openai/v1/chat/completions";

// Groq renueva y retira modelos con bastante frecuencia, así que estos
// son solo un punto de partida razonable: se cambian con GROQ_MODEL y
// GROQ_MODEL_VISION sin tocar código. Si el que está puesto ya no
// existe, la prueba de Configuración → Ayuda lo dice tal cual
// ("model not found") en vez de dejar el Asistente mudo sin explicar.
const MODELO_POR_DEFECTO = "llama-3.3-70b-versatile";

// Analizar la foto de un producto necesita un modelo que sepa VER, y
// esos son pocos. Va en su propia variable para que abaratar o cambiar
// el modelo de texto no rompa el análisis de fotos.
// El nombre correcto es GROQ_MODEL_VISION, en inglés como GROQ_MODEL.
// GROQ_MODELO_VISION (medio en español) se acepta porque fue el nombre
// original y alguien ya puede tenerlo puesto — cambiarlo a secas le
// apagaría el análisis de fotos sin decirle nada.
//
// Que existieran dos convenciones era una trampa de verdad: quien
// escribía el nombre "obvio" no recibía ningún error, la app usaba el
// valor por defecto en silencio, y desde fuera eso se ve idéntico a
// "el modelo por defecto no sirve".
function modeloVisionConfigurado(): string | undefined {
  return process.env.GROQ_MODEL_VISION || process.env.GROQ_MODELO_VISION;
}

const MODELO_VISION_POR_DEFECTO = "meta-llama/llama-4-scout-17b-16e-instruct";

// Qué modelo se va a usar de verdad. Existen para que NADIE más tenga
// que repetir la expresión "variable de entorno o el de por defecto":
// el diagnóstico de Configuración → Ayuda tenía los dos nombres por
// defecto escritos a mano, así que al cambiarlos aquí habría empezado a
// reportar un modelo distinto del que la app realmente usa. Un
// diagnóstico que miente es peor que no tener diagnóstico.
//
// porDefecto viaja aparte (y no pegado al nombre) para que la pantalla
// lo pueda traducir: aquí es código de servidor y no sabe en qué idioma
// está la persona.
export function modeloTextoEnUso(): { modelo: string; porDefecto: boolean } {
  const configurado = process.env.GROQ_MODEL;
  return { modelo: configurado || MODELO_POR_DEFECTO, porDefecto: !configurado };
}

export function modeloVisionEnUso(): { modelo: string; porDefecto: boolean } {
  const configurado = modeloVisionConfigurado();
  return { modelo: configurado || MODELO_VISION_POR_DEFECTO, porDefecto: !configurado };
}

// Un asistente de negocio no necesita ensayos: respuestas largas
// cuestan más, tardan más y se leen peor en un celular tras el
// mostrador.
const MAX_TOKENS_RESPUESTA = 700;

// true cuando el servidor tiene con qué hablarle a Groq. Las
// rutas lo usan para decidir el proveedor sin tener que atrapar un
// error primero.
export function hayGroq(): boolean {
  return !!process.env.GROQ_API_KEY;
}

export interface MensajeChat {
  rol: "usuario" | "asistente";
  texto: string;
}

export class ErrorGroq extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ErrorGroq";
    this.status = status;
  }
}

// Las emociones de Corebot, la mascota del Asistente. "pensando" es
// la única que NO se le pide al modelo — la pone el navegador solo
// mientras espera la respuesta, así que dársela también al modelo
// crearía dos dueños para el mismo estado.
export type EmocionCorebot =
  | "feliz"
  | "pensando"
  | "sorprendido"
  | "analizando"
  | "concentrado"
  | "ayudando"
  | "emocionado"
  | "durmiendo";

const EMOCIONES_VALIDAS: EmocionCorebot[] = [
  "feliz",
  "pensando",
  "sorprendido",
  "analizando",
  "concentrado",
  "ayudando",
  "emocionado",
  "durmiendo",
];

export interface RespuestaAsistente {
  texto: string;
  emocion: EmocionCorebot | null;
}

// El modelo cierra su respuesta con una línea `[[emocion:X]]` que la
// persona nunca ve — se recorta acá y se usa para que Corebot
// reaccione con la cara/pose que el propio modelo eligió, en vez de
// una animación desconectada de lo que se está hablando. Si el
// modelo no la puso, o puso algo que no está en la lista, se
// devuelve el texto tal cual y sin emoción forzada.
// Exportada porque lib/googleAI.ts también la necesita: el modelo de
// Google cierra su respuesta con la misma línea `[[emocion:X]]` (el
// prompt es el mismo, ver construirPromptAsistente en promptsIA.ts), y
// mantener el recorte en un solo sitio evita que un arreglo aquí se
// aplique solo a uno de los dos proveedores.
export function extraerEmocion(textoCrudo: string): RespuestaAsistente {
  const coincidencia = textoCrudo.match(/\n?\s*\[\[\s*emocion\s*:\s*(\w+)\s*\]\]\s*$/i);

  if (!coincidencia) {
    return { texto: textoCrudo, emocion: null };
  }

  const candidata = coincidencia[1].toLowerCase() as EmocionCorebot;
  const texto = textoCrudo.slice(0, coincidencia.index).trim();

  return {
    texto: texto || textoCrudo,
    emocion: EMOCIONES_VALIDAS.includes(candidata) ? candidata : null,
  };
}

export async function generarRespuestaAsistente(
  pregunta: string,
  historial: MensajeChat[],
  contexto: ContextoNegocio,
  idioma: string
): Promise<RespuestaAsistente> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    // 401 y no 500: no es una falla transitoria, reintentar nunca lo va
    // a arreglar. Quien llama lo usa para caer al motor de reglas sin
    // molestar a la persona con un error.
    throw new ErrorGroq("Falta configurar GROQ_API_KEY en el servidor.", 401);
  }

  const { modelo } = modeloTextoEnUso();

  const mensajes = [
    { role: "system", content: construirPromptAsistente(contexto, idioma) },
    ...historial.map((m) => ({
      role: m.rol === "usuario" ? "user" : "assistant",
      content: m.texto,
    })),
    { role: "user", content: pregunta },
  ];

  const textoCrudo = await pedirTexto(modelo, mensajes, {
    temperatura: 0.6,
    maxTokens: MAX_TOKENS_RESPUESTA,
    // Menos plazo que analizar una foto: una respuesta de chat que tarda
    // más de medio minuto ya no sirve, y cortar antes deja tiempo de
    // caer al motor de reglas dentro del límite de la función.
    plazoMs: 30000,
  });

  return extraerEmocion(textoCrudo);
}

// Misma conversación que generarRespuestaAsistente, pero con una foto
// adjunta — usa el modelo de VISIÓN (no el de texto normal), así que
// solo entra en juego cuando la pregunta trae una imagen. Se usa cuando
// no hay llave de Google configurada (que es a quien prefiere atender
// las fotos, ver app/api/ia/asistente/route.ts) para que el Asistente
// siga aceptando fotos sin obligar a nadie a abrir una segunda cuenta.
export async function generarRespuestaAsistenteConImagen(
  pregunta: string,
  imagenBase64: string,
  mimeType: string,
  historial: MensajeChat[],
  contexto: ContextoNegocio,
  idioma: string
): Promise<RespuestaAsistente> {
  const { modelo } = modeloVisionEnUso();

  const mensajes = [
    { role: "system", content: construirPromptAsistente(contexto, idioma) },
    ...historial.map((m) => ({
      role: m.rol === "usuario" ? "user" : "assistant",
      content: m.texto,
    })),
    {
      role: "user",
      content: [
        { type: "text", text: pregunta || "¿Qué ves en esta foto?" },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${imagenBase64}` } },
      ],
    },
  ];

  const textoCrudo = await pedirTexto(modelo, mensajes, {
    temperatura: 0.6,
    maxTokens: MAX_TOKENS_RESPUESTA,
    plazoMs: 45000,
  });

  return extraerEmocion(textoCrudo);
}

// ---------------------------------------------------------------------
// Las otras dos funciones de IA de la app, servidas también por
// Groq para que una sola llave encienda todo: el análisis de
// fotos de producto y el vendedor de WhatsApp. Los prompts y el parseo
// son los mismos que usa Google (lib/promptsIA.ts) — lo único que
// cambia es a quién se le pregunta.
// ---------------------------------------------------------------------

// Núcleo compartido: manda mensajes y devuelve el texto de la
// respuesta. Todo lo delicado (plazo, errores en un 200, respuesta
// vacía) vive aquí una sola vez.
async function pedirTexto(
  modelo: string,
  mensajes: unknown[],
  opciones: { temperatura: number; maxTokens: number; plazoMs: number }
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new ErrorGroq("Falta configurar GROQ_API_KEY en el servidor.", 401);
  }

  // Sin plazo, una respuesta lenta deja la pantalla colgada y en un
  // host serverless consume el tiempo de la función hasta que la corta
  // de golpe, sin dar oportunidad de caer al respaldo.
  const control = new AbortController();
  const plazo = setTimeout(() => control.abort(), opciones.plazoMs);

  let respuesta: Response;

  try {
    respuesta = await fetch(URL_GROQ, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelo,
        messages: mensajes,
        max_tokens: opciones.maxTokens,
        temperature: opciones.temperatura,
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
    throw new ErrorGroq(detalle, respuesta.status);
  }

  const datos = await respuesta.json();

  if (datos?.error) {
    throw new ErrorGroq(datos.error.message || "Error de Groq.", 502);
  }

  const texto = datos?.choices?.[0]?.message?.content;

  if (typeof texto !== "string" || !texto.trim()) {
    throw new ErrorGroq("Groq no devolvió una respuesta utilizable.", 502);
  }

  return texto.trim();
}

export async function analizarImagenProductoGroq(
  imagenBase64: string,
  mimeType: string,
  idioma: string,
  categoriasExistentes: string[] = []
): Promise<ResultadoAnalisisProducto> {
  const { modelo } = modeloVisionEnUso();

  // La imagen viaja como data URI dentro del propio mensaje, en el
  // formato de partes de contenido de la API de chat.
  const texto = await pedirTexto(
    modelo,
    [
      {
        role: "user",
        content: [
          { type: "text", text: construirPromptProducto(idioma, categoriasExistentes) },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imagenBase64}` } },
        ],
      },
    ],
    { temperatura: 0.4, maxTokens: 500, plazoMs: 45000 }
  );

  return extraerResultadoProducto(texto);
}

export async function generarRespuestaVendedorGroq(
  pregunta: string,
  productos: ProductoParaVendedor[],
  idioma: string
): Promise<string> {
  const { modelo } = modeloTextoEnUso();

  return pedirTexto(
    modelo,
    [{ role: "user", content: construirPromptVendedor(pregunta, productos, idioma) }],
    { temperatura: 0.5, maxTokens: 400, plazoMs: 30000 }
  );
}

export async function generarMensajeClienteGroq(
  datos: DatosAnalisisEntidad,
  nombreNegocio: string | null,
  idioma: string
): Promise<string> {
  const { modelo } = modeloTextoEnUso();

  return pedirTexto(
    modelo,
    [{ role: "user", content: construirPromptMensajeCliente(datos, nombreNegocio, idioma) }],
    { temperatura: 0.6, maxTokens: 250, plazoMs: 30000 }
  );
}

export async function generarMensajeProveedorGroq(
  datos: DatosAnalisisEntidad,
  nombreNegocio: string | null,
  idioma: string
): Promise<string> {
  const { modelo } = modeloTextoEnUso();

  return pedirTexto(
    modelo,
    [{ role: "user", content: construirPromptMensajeProveedor(datos, nombreNegocio, idioma) }],
    { temperatura: 0.5, maxTokens: 250, plazoMs: 30000 }
  );
}

// Devuelve el texto crudo del modelo (un array JSON, en teoría) — quien
// llama lo pasa por extraerHrefsRecomendados de promptsIA.ts para
// validarlo contra el catálogo real antes de confiar en nada.
export async function generarModulosRecomendadosGroq(
  descripcionNegocio: string,
  catalogo: ModuloCatalogo[]
): Promise<string> {
  const { modelo } = modeloTextoEnUso();

  return pedirTexto(
    modelo,
    [{ role: "user", content: construirPromptRecomendarModulos(descripcionNegocio, catalogo) }],
    { temperatura: 0.3, maxTokens: 300, plazoMs: 20000 }
  );
}

// Prueba mínima de que el modelo de visión existe y acepta imágenes.
//
// Deliberadamente NO usa analizarImagenProductoGroq: esa función exige
// que la respuesta sea el JSON del catálogo, y ante una imagen de
// prueba (un pixel transparente) un modelo perfectamente sano puede
// contestar cualquier cosa. Eso daría un "no funciona" falso justo
// cuando sí funciona. Aquí solo importa que la llamada no reviente.
export async function probarVisionGroq(): Promise<void> {
  const { modelo } = modeloVisionEnUso();

  // PNG de 1x1 transparente: lo más chico que se puede mandar.
  const pixel =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  await pedirTexto(
    modelo,
    [
      {
        role: "user",
        content: [
          { type: "text", text: "Responde solo: ok" },
          { type: "image_url", image_url: { url: `data:image/png;base64,${pixel}` } },
        ],
      },
    ],
    // 5 tokens parecían de sobra para contestar "ok", pero un modelo
    // sano que empiece con cualquier cosa antes (una cortesía, o el
    // bloque de razonamiento que emiten los modelos de razonamiento) se
    // queda cortado a la mitad y devuelve contenido vacío. Eso hace que
    // pedirTexto lo dé por roto: un "las fotos no funcionan" falso justo
    // cuando sí funcionan, que es el error más caro que puede cometer un
    // diagnóstico. 64 sigue siendo una llamada insignificante.
    { temperatura: 0, maxTokens: 64, plazoMs: 30000 }
  );
}

// Lista los modelos que la cuenta tiene disponibles AHORA. Groq expone
// esto en su API, así que es la única fuente que no envejece: cualquier
// lista escrita a mano en el código o en la documentación queda vieja
// en cuanto Groq rota su catálogo, que lo hace seguido.
//
// Se usa en el diagnóstico de Configuración → Ayuda para que, cuando el
// modelo configurado ya no exista, se pueda elegir uno de la lista real
// en vez de adivinar.
//
// Devuelve [] si algo falla: es información de apoyo, y no vale la pena
// que un fallo aquí tumbe el diagnóstico entero, que es lo importante.
export async function listarModelosGroq(): Promise<string[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return [];

  const control = new AbortController();
  const plazo = setTimeout(() => control.abort(), 15000);

  try {
    const respuesta = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: control.signal,
    });

    if (!respuesta.ok) return [];

    const datos = await respuesta.json();
    const lista = Array.isArray(datos?.data) ? datos.data : [];

    return lista
      .map((m: { id?: unknown }) => (typeof m?.id === "string" ? m.id : null))
      .filter((id: string | null): id is string => !!id)
      .sort();
  } catch {
    return [];
  } finally {
    clearTimeout(plazo);
  }
}
