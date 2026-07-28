// Cliente para la API de Google AI Studio (Gemini). Uso EXCLUSIVO en
// código de servidor (app/api/**) — GOOGLE_AI_API_KEY nunca debe
// exponerse al navegador.

import {
  construirPromptProducto,
  construirPromptVendedor,
  extraerResultadoProducto,
  ResultadoAnalisisProducto,
  ProductoParaVendedor,
} from "./promptsIA";

// Los prompts y la reparación del JSON que devuelve el modelo viven en
// lib/promptsIA.ts: son idénticos para Google y para Groq, y
// tenerlos duplicados garantizaba que un arreglo se aplicara en uno
// solo de los dos.
export type { ResultadoAnalisisProducto, ProductoParaVendedor };

const MODELO_POR_DEFECTO = "gemini-flash-latest";

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

export async function analizarImagenProducto(
  imagenBase64: string,
  mimeType: string,
  idioma: string,
  categoriasExistentes: string[] = []
): Promise<ResultadoAnalisisProducto> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    // Mismo tratamiento que una clave inválida (401 de la API): no es
    // una falla transitoria, reintentar nunca lo va a arreglar.
    throw new ErrorGoogleAI("Falta configurar GOOGLE_AI_API_KEY en el servidor.", 401);
  }

  const modelo = process.env.GOOGLE_AI_MODEL || MODELO_POR_DEFECTO;

  const respuesta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: construirPromptProducto(idioma, categoriasExistentes) },
              { inline_data: { mime_type: mimeType, data: imagenBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );

  if (!respuesta.ok) {
    throw await errorDesdeRespuesta(respuesta);
  }

  const datos = await respuesta.json();
  const texto = datos?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof texto !== "string" || !texto.trim()) {
    throw new Error("Google AI no devolvió una respuesta utilizable.");
  }

  return extraerResultadoProducto(texto);
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
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    throw new ErrorGoogleAI("Falta configurar GOOGLE_AI_API_KEY en el servidor.", 401);
  }

  const modelo = process.env.GOOGLE_AI_MODEL || MODELO_POR_DEFECTO;

  const respuesta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: construirPromptVendedor(pregunta, productos, idioma) }] }],
        generationConfig: { temperature: 0.5, thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  );

  if (!respuesta.ok) {
    throw await errorDesdeRespuesta(respuesta);
  }

  const datos = await respuesta.json();
  const texto = datos?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof texto !== "string" || !texto.trim()) {
    throw new Error("Google AI no devolvió una respuesta utilizable.");
  }

  return texto.trim();
}
