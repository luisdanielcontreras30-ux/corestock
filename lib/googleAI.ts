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
  categoria: string;
  descripcion: string;
}

function construirPrompt(idioma: string, categoriasExistentes: string[]): string {
  const idiomaTexto = NOMBRE_IDIOMA[idioma] ?? "español";

  // Si el negocio ya tiene categorías, se le pasan a la IA para que
  // reutilice una en vez de inventar variantes casi idénticas (ej.
  // "Bebida" vs "Bebidas") cada vez que se analiza una foto nueva.
  const pistaCategorias =
    categoriasExistentes.length > 0
      ? `Las categorías que este negocio ya usa son: ${categoriasExistentes.join(", ")}. ` +
        "Si el producto encaja claramente en alguna, usa exactamente ese mismo texto. " +
        "Si ninguna encaja, proponé una categoría corta nueva. "
      : "";

  return (
    "Eres un asistente que ayuda a dueños de pequeños negocios a catalogar " +
    "productos a partir de una foto. Mira la imagen y responde ÚNICAMENTE " +
    'con un JSON de la forma {"nombre": "...", "categoria": "...", ' +
    '"descripcion": "..."}, sin texto ni explicación fuera del JSON. ' +
    `Escribe los tres campos en ${idiomaTexto}. ` +
    '"nombre": un nombre corto y claro del producto, máximo 6 palabras, sin ' +
    "marca a menos que sea visible en el empaque. " +
    '"categoria": una categoría general de catálogo, 1 a 3 palabras (ej. ' +
    '"Electrónica", "Ropa", "Alimentos"). ' +
    pistaCategorias +
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
      // categoria es un extra útil, no crítico — si el modelo la omite
      // o la manda mal, no vale la pena descartar nombre/descripcion
      // (que sí salieron bien) solo por eso.
      const categoriaBruta = (json as { categoria?: unknown }).categoria;
      const categoria = typeof categoriaBruta === "string" ? categoriaBruta.trim() : "";
      if (nombre && descripcion) return { nombre, categoria, descripcion };
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

  // Intento 3: extracción directa de los campos por regex — cubre el
  // caso de un JSON al que le falta la "}" de cierre pero cuyos
  // valores sí están completos y bien entrecomillados.
  const nombreMatch = limpio.match(/"nombre"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const categoriaMatch = limpio.match(/"categoria"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const descripcionMatch = limpio.match(/"descripcion"\s*:\s*"((?:[^"\\]|\\.)*)"/);

  if (nombreMatch && descripcionMatch) {
    const nombre = nombreMatch[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim();
    const descripcion = descripcionMatch[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim();
    const categoria = categoriaMatch
      ? categoriaMatch[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim()
      : "";
    if (nombre && descripcion) return { nombre, categoria, descripcion };
  }

  throw new Error("La respuesta de Google AI no tiene el formato esperado.");
}

export async function analizarImagenProducto(
  imagenBase64: string,
  mimeType: string,
  idioma: string,
  categoriasExistentes: string[] = []
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
              { text: construirPrompt(idioma, categoriasExistentes) },
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
