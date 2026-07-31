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
  // Estimación de mercado. OPCIONAL a propósito: si el modelo no la
  // devuelve, o la devuelve mal, el análisis sigue sirviendo para lo de
  // siempre (catalogar el producto) en vez de fallar entero.
  //
  // No son datos medidos de ningún lado: son lo que el modelo sabe del
  // mercado en general. La pantalla que las muestra lo dice con todas
  // sus letras, porque son cifras con las que alguien decide qué
  // comprar con su dinero.
  mercado?: EstimacionMercado;
}

export interface EstimacionMercado {
  // Margen bruto típico del producto, en porcentaje sobre el precio de
  // venta. Dos números y no uno: un rango dice honestamente que es una
  // horquilla, mientras que "38%" suena a medición.
  margenMin: number;
  margenMax: number;
  // Qué tan rápido suele rotar. Se guarda como número de 1 a 5 para
  // poder dibujarlo, con su etiqueta en el idioma de quien pregunta.
  rotacion: number;
  // Qué tanta demanda general tiene, también de 1 a 5.
  demanda: number;
  // Una o dos frases del modelo sobre el producto en el mercado
  // (estacionalidad, competencia, a quién le vende).
  nota: string;
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
    "se puedan ver en la imagen. " +
    // La estimación de mercado va en el mismo JSON para no gastar una
    // segunda llamada al modelo por cada foto.
    '"mercado": un objeto con tu estimación de cómo se comporta ESTE TIPO ' +
    "de producto en el comercio minorista en general, con la forma " +
    '{"margen_min": 25, "margen_max": 40, "rotacion": 4, "demanda": 3, ' +
    '"nota": "..."}. ' +
    '"margen_min" y "margen_max": el rango de margen bruto típico en ' +
    "porcentaje sobre el precio de venta, como números enteros entre 0 y 90. " +
    '"rotacion": qué tan rápido suele venderse, entero de 1 (muy lento) a ' +
    "5 (se vende solo). " +
    '"demanda": qué tanta gente lo busca, entero de 1 (nicho muy pequeño) ' +
    "a 5 (lo compra casi cualquiera). " +
    `"nota": 1 o 2 frases en ${idiomaTexto} sobre cómo se vende este tipo de ` +
    "producto: estacionalidad, competencia o a qué público le sirve. " +
    "Basa el objeto \"mercado\" en tu conocimiento general del comercio, no " +
    "en datos de ningún negocio concreto, y no exageres: si no estás " +
    "seguro, da un rango amplio en vez de un número preciso."
  );
}

// Convierte el objeto "mercado" que devuelve el modelo en algo que se
// pueda dibujar sin sustos, o en undefined si no vino utilizable.
//
// Se recorta a los rangos declarados en vez de confiar: un modelo puede
// devolver un margen de 250% o una rotación de 9, y esos números
// acabarían pintados en una barra que se sale de su caja o, peor,
// leídos como si fueran ciertos.
function normalizarMercado(bruto: unknown): EstimacionMercado | undefined {
  if (!bruto || typeof bruto !== "object") return undefined;

  const obj = bruto as Record<string, unknown>;

  const entero = (valor: unknown, minimo: number, maximo: number): number | null => {
    const n = typeof valor === "number" ? valor : Number(valor);
    if (!Number.isFinite(n)) return null;
    return Math.min(maximo, Math.max(minimo, Math.round(n)));
  };

  const margenMin = entero(obj.margen_min, 0, 90);
  const margenMax = entero(obj.margen_max, 0, 90);
  const rotacion = entero(obj.rotacion, 1, 5);
  const demanda = entero(obj.demanda, 1, 5);

  if (margenMin === null || margenMax === null || rotacion === null || demanda === null) {
    return undefined;
  }

  const nota = typeof obj.nota === "string" ? obj.nota.trim() : "";

  return {
    // Si llegan al revés, se ordenan: un rango con el mínimo por encima
    // del máximo rompería la barra al dibujarla.
    margenMin: Math.min(margenMin, margenMax),
    margenMax: Math.max(margenMin, margenMax),
    rotacion,
    demanda,
    nota,
  };
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
      const mercado = normalizarMercado((json as { mercado?: unknown }).mercado);
      if (nombre && descripcion) return { nombre, categoria, descripcion, mercado };
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

// Un cliente con historial suficiente para que valga la pena sugerirle
// recompra — ya viene resumido (no las ventas en crudo) porque lo único
// que necesita el modelo es "qué le gusta y hace cuánto no viene", no
// cada fila de la tabla ventas.
export interface ClienteFrecuenteInfo {
  id: number;
  nombre: string;
  compras: number;
  productoTop: string | null;
  diasDesdeUltimaCompra: number | null;
}

export interface SugerenciaRecompra {
  clienteId: number;
  mensaje: string;
}

export function construirPromptRecompra(
  clientes: ClienteFrecuenteInfo[],
  nombreNegocio: string | null,
  idioma: string
): string {
  const idiomaTexto = NOMBRE_IDIOMA[idioma] ?? "español";
  const negocio = nombreNegocio?.trim() || "el negocio";

  const listaTexto = clientes
    .map((c) => {
      const producto = c.productoTop ? `suele comprar "${c.productoTop}"` : "sin un producto favorito claro";
      const ultima =
        c.diasDesdeUltimaCompra === null
          ? "sin fecha de última compra registrada"
          : `su última compra fue hace ${c.diasDesdeUltimaCompra} días`;
      return `- id ${c.id}: ${c.nombre}, ${c.compras} compras en total, ${producto}, ${ultima}.`;
    })
    .join("\n");

  return (
    `Eres un asistente de marketing para ${negocio}, un negocio pequeño que usa CoreStock. ` +
    "Te doy una lista de sus clientes más frecuentes con su historial de compras. " +
    "Para CADA UNO, escribe un mensaje corto de WhatsApp (máximo 3 frases) invitándolo a " +
    "volver a comprar, mencionando el producto que más le gusta cuando lo tengas. " +
    `Escribe en ${idiomaTexto}, en tono cercano y amable, tuteando. ` +
    "NUNCA inventes descuentos, promociones, precios ni fechas límite que no te haya dado — " +
    "si quieres invitarlo, hazlo sin prometer nada que no esté en los datos. " +
    "NUNCA uses un tono de urgencia o presión (nada de \"última oportunidad\", \"solo hoy\"). " +
    'Responde ÚNICAMENTE con un JSON de la forma {"sugerencias": [{"cliente_id": 1, "mensaje": "..."}, ...]}, ' +
    "un objeto por cada cliente de la lista, en el mismo orden, sin texto fuera del JSON.\n\n" +
    `Clientes:\n${listaTexto}`
  );
}

// Mismo enfoque de reparación por capas que extraerResultadoProducto:
// el modelo puede devolver el JSON sin cerrar bien, o con texto extra
// alrededor — se intenta cada vez de forma más tolerante antes de
// darse por vencido.
export function extraerSugerenciasRecompra(texto: string): SugerenciaRecompra[] {
  const limpio = texto
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  function normalizarLista(json: unknown): SugerenciaRecompra[] | null {
    const bruto = (json as { sugerencias?: unknown })?.sugerencias;
    if (!Array.isArray(bruto)) return null;

    const lista: SugerenciaRecompra[] = [];
    for (const item of bruto) {
      const clienteIdBruto = (item as { cliente_id?: unknown })?.cliente_id;
      const mensajeBruto = (item as { mensaje?: unknown })?.mensaje;
      const clienteId = typeof clienteIdBruto === "number" ? clienteIdBruto : Number(clienteIdBruto);
      const mensaje = typeof mensajeBruto === "string" ? mensajeBruto.trim() : "";
      if (Number.isFinite(clienteId) && mensaje) {
        lista.push({ clienteId, mensaje });
      }
    }
    return lista.length > 0 ? lista : null;
  }

  try {
    const directo = normalizarLista(JSON.parse(limpio));
    if (directo) return directo;
  } catch {
    // sigue abajo
  }

  const inicio = limpio.indexOf("{");
  if (inicio !== -1) {
    let profundidad = 0;
    for (let i = inicio; i < limpio.length; i++) {
      if (limpio[i] === "{") profundidad++;
      else if (limpio[i] === "}") {
        profundidad--;
        if (profundidad === 0) {
          try {
            const balanceado = normalizarLista(JSON.parse(limpio.slice(inicio, i + 1)));
            if (balanceado) return balanceado;
          } catch {
            // sigue abajo
          }
          break;
        }
      }
    }
  }

  throw new Error("La respuesta de la IA no tiene el formato esperado.");
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

