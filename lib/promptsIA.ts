// Prompts y parseo compartidos por los dos proveedores de IA
// (lib/googleAI.ts y lib/groq.ts). Vive aparte porque el texto
// del prompt y —sobre todo— la reparación del JSON que devuelve el
// modelo son lo mismo sin importar quién conteste, y tenerlo duplicado
// garantizaba que un arreglo se aplicara solo en uno de los dos.
//
// Sin dependencias de red: solo texto entra y texto sale.

export const NOMBRE_IDIOMA: Record<string, string> = {
  es: "español",
  en: "inglés",
  pt: "portugués",
  fr: "francés",
  de: "alemán",
  zh: "chino",
  it: "italiano",
};

export interface ResultadoAnalisisProducto {
  nombre: string;
  categoria: string;
  descripcion: string;
}

export function construirPromptProducto(idioma: string, categoriasExistentes: string[]): string {
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
export function extraerResultadoProducto(texto: string): ResultadoAnalisisProducto {
  const limpio = texto
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  function normalizarProducto(json: unknown): ResultadoAnalisisProducto | null {
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
    const directo = normalizarProducto(JSON.parse(limpio));
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
            const balanceado = normalizarProducto(JSON.parse(limpio.slice(inicio, i + 1)));
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

export interface ProductoParaVendedor {
  nombre: string;
  categoria: string | null;
  precio_venta: number;
  stock: number;
}

export function construirPromptVendedor(
  pregunta: string,
  productos: ProductoParaVendedor[],
  idioma: string
): string {
  const idiomaTexto = NOMBRE_IDIOMA[idioma] ?? "español";

  const catalogoTexto =
    productos.length > 0
      ? productos
          .map(
            (p) =>
              `- ${p.nombre} (${p.categoria || "sin categoría"}): $${p.precio_venta}, ` +
              (p.stock > 0 ? `${p.stock} disponibles` : "agotado")
          )
          .join("\n")
      : "(El catálogo todavía no tiene productos.)";

  return (
    "Eres el vendedor virtual de un negocio, respondiendo por WhatsApp a un " +
    "cliente. Responde ÚNICAMENTE con el mensaje que le mandarías al cliente " +
    "— sin explicaciones, sin markdown, en tono amable y breve (máximo 3 " +
    `frases). Responde en ${idiomaTexto}. ` +
    "SOLO puedes usar la información del catálogo de abajo: si preguntan por " +
    "algo que no está en la lista, dilo amablemente sin inventar precios ni " +
    "existencias. Si el stock de un producto es 0, di que está agotado — " +
    "nunca lo ofrezcas como disponible.\n\n" +
    `Catálogo:\n${catalogoTexto}\n\n` +
    `Pregunta del cliente: "${pregunta}"`
  );
}

