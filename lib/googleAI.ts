// Cliente para la API de Google AI Studio (Gemini). Uso EXCLUSIVO en
// código de servidor (app/api/**) — GOOGLE_AI_API_KEY nunca debe
// exponerse al navegador.

const MODELO_POR_DEFECTO = "gemini-flash-latest";

const NOMBRE_IDIOMA: Record<string, string> = {
  es: "español",
  en: "inglés",
  pt: "portugués",
  fr: "francés",
  de: "alemán",
  zh: "chino",
};

export interface ResultadoAnalisisProducto {
  nombre: string;
  descripcion: string;
}

function construirPrompt(idioma: string): string {
  const idiomaTexto = NOMBRE_IDIOMA[idioma] ?? "español";

  return (
    "Eres un asistente que ayuda a dueños de pequeños negocios a catalogar " +
    "productos a partir de una foto. Mira la imagen y responde ÚNICAMENTE " +
    'con un JSON de la forma {"nombre": "...", "descripcion": "..."}, sin ' +
    "texto ni explicación fuera del JSON. " +
    `Escribe ambos campos en ${idiomaTexto}. ` +
    '"nombre": un nombre corto y claro del producto, máximo 6 palabras, sin ' +
    "marca a menos que sea visible en el empaque. " +
    '"descripcion": una descripción breve y atractiva para un catálogo de ' +
    "ventas al público, 1 o 2 frases, sin inventar características que no " +
    "se puedan ver en la imagen."
  );
}

// El modelo a veces no cierra bien el JSON (le falta la "}" final) o
// agrega llaves de sobra después de cerrarlo — pasa incluso con
// responseMimeType:"application/json". En vez de confiar en un
// JSON.parse directo, se intenta en capas cada vez más tolerantes.
function extraerResultado(texto: string): ResultadoAnalisisProducto {
  const limpio = texto
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  function normalizar(json: unknown): ResultadoAnalisisProducto | null {
    if (
      json &&
      typeof json === "object" &&
      typeof (json as { nombre?: unknown }).nombre === "string" &&
      typeof (json as { descripcion?: unknown }).descripcion === "string"
    ) {
      const nombre = (json as { nombre: string }).nombre.trim();
      const descripcion = (json as { descripcion: string }).descripcion.trim();
      if (nombre && descripcion) return { nombre, descripcion };
    }
    return null;
  }

  // Intento 1: el texto completo ya es JSON válido.
  try {
    const directo = normalizar(JSON.parse(limpio));
    if (directo) return directo;
  } catch {
    // sigue abajo
  }

  // Intento 2: recorta desde la primera "{" hasta que las llaves
  // vuelven a balancearse en 0 (ignora cualquier cosa después, como
  // una "}" de sobra al final).
  const inicio = limpio.indexOf("{");
  if (inicio !== -1) {
    let profundidad = 0;
    for (let i = inicio; i < limpio.length; i++) {
      if (limpio[i] === "{") profundidad++;
      else if (limpio[i] === "}") {
        profundidad--;
        if (profundidad === 0) {
          try {
            const balanceado = normalizar(JSON.parse(limpio.slice(inicio, i + 1)));
            if (balanceado) return balanceado;
          } catch {
            // sigue abajo
          }
          break;
        }
      }
    }
  }

  // Intento 3: extracción directa de los dos campos por regex — cubre
  // el caso de un JSON al que le falta la "}" de cierre pero cuyos
  // valores sí están completos y bien entrecomillados.
  const nombreMatch = limpio.match(/"nombre"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const descripcionMatch = limpio.match(/"descripcion"\s*:\s*"((?:[^"\\]|\\.)*)"/);

  if (nombreMatch && descripcionMatch) {
    const nombre = nombreMatch[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim();
    const descripcion = descripcionMatch[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim();
    if (nombre && descripcion) return { nombre, descripcion };
  }

  throw new Error("La respuesta de Google AI no tiene el formato esperado.");
}

export async function analizarImagenProducto(
  imagenBase64: string,
  mimeType: string,
  idioma: string
): Promise<ResultadoAnalisisProducto> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    throw new Error("Falta configurar GOOGLE_AI_API_KEY en el servidor.");
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
              { text: construirPrompt(idioma) },
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
    let detalle = `HTTP ${respuesta.status}`;
    try {
      const cuerpo = await respuesta.json();
      detalle = cuerpo?.error?.message || detalle;
    } catch {
      // sin cuerpo JSON legible, se deja el detalle genérico
    }
    throw new Error(detalle);
  }

  const datos = await respuesta.json();
  const texto = datos?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof texto !== "string" || !texto.trim()) {
    throw new Error("Google AI no devolvió una respuesta utilizable.");
  }

  return extraerResultado(texto);
}
