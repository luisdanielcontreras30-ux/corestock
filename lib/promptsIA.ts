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

// Un cliente o proveedor con historial suficiente para analizar — ya
// viene resumido (no las ventas/compras en crudo) porque lo único que
// necesita el modelo es "qué le gusta y hace cuánto no viene", no cada
// fila de la tabla.
export interface DatosAnalisisEntidad {
  nombre: string;
  compras: number;
  productoTop: string | null;
  diasDesdeUltimaCompra: number | null;
}

// El mensaje sale en texto plano (no JSON): al ser una sola entidad por
// llamada, no hace falta la maquinaria de "reparar JSON de una lista"
// que sí se necesitaba cuando esto analizaba varios clientes a la vez.
export function construirPromptMensajeCliente(
  datos: DatosAnalisisEntidad,
  nombreNegocio: string | null,
  idioma: string
): string {
  const idiomaTexto = NOMBRE_IDIOMA[idioma] ?? "español";
  const negocio = nombreNegocio?.trim() || "el negocio";
  const producto = datos.productoTop ? `suele comprar "${datos.productoTop}"` : "sin un producto favorito claro";
  const ultima =
    datos.diasDesdeUltimaCompra === null
      ? "sin fecha de última compra registrada"
      : `su última compra fue hace ${datos.diasDesdeUltimaCompra} días`;

  return (
    `Eres un asistente de marketing para ${negocio}, un negocio pequeño que usa CoreStock. ` +
    `Te doy el historial de un cliente: ${datos.nombre}, ${datos.compras} compras en total, ${producto}, ${ultima}. ` +
    "Escribe UN mensaje corto de WhatsApp (máximo 3 frases) invitándolo a volver a comprar, " +
    "mencionando el producto que más le gusta cuando lo tengas. " +
    `Escribe en ${idiomaTexto}, en tono cercano y amable, tuteando. ` +
    "NUNCA inventes descuentos, promociones, precios ni fechas límite que no te haya dado — " +
    "si quieres invitarlo, hazlo sin prometer nada que no esté en los datos. " +
    "NUNCA uses un tono de urgencia o presión (nada de \"última oportunidad\", \"solo hoy\"). " +
    "Responde ÚNICAMENTE con el mensaje, sin comillas, sin explicación ni texto adicional."
  );
}

export function construirPromptMensajeProveedor(
  datos: DatosAnalisisEntidad,
  nombreNegocio: string | null,
  idioma: string
): string {
  const idiomaTexto = NOMBRE_IDIOMA[idioma] ?? "español";
  const negocio = nombreNegocio?.trim() || "el negocio";
  const producto = datos.productoTop ? `lo que más le compra es "${datos.productoTop}"` : "sin un producto principal claro";
  const ultima =
    datos.diasDesdeUltimaCompra === null
      ? "sin fecha del último pedido registrada"
      : `el último pedido fue hace ${datos.diasDesdeUltimaCompra} días`;

  return (
    `Eres un asistente de compras para ${negocio}, un negocio pequeño que usa CoreStock. ` +
    `Te doy el historial de un proveedor: ${datos.nombre}, ${datos.compras} pedidos en total, ${producto}, ${ultima}. ` +
    "Escribe UN mensaje corto de WhatsApp (máximo 3 frases) preguntándole si puede volver a surtir o " +
    "cotizar lo que más le has comprado, mencionando que ya le compraste antes. " +
    `Escribe en ${idiomaTexto}, en tono profesional y directo, tuteando. ` +
    "NUNCA inventes cantidades, precios ni fechas de entrega que no te haya dado — pregunta " +
    "disponibilidad y precio en vez de darlos por hecho. " +
    "Responde ÚNICAMENTE con el mensaje, sin comillas, sin explicación ni texto adicional."
  );
}

// Un módulo del catálogo cerrado que se le ofrece a elegir a la IA
// (ver lib/tiposNegocio.ts MODULOS_PERSONALIZABLES) — nombre y
// descripción ya en el idioma de la cuenta, para que el modelo
// entienda qué hace cada uno sin adivinar por el href.
export interface ModuloCatalogo {
  href: string;
  nombre: string;
  descripcion: string;
}

// Recomendación de qué módulos activar de entrada en el menú, según el
// tipo de negocio (o su descripción libre, para "otro"). SOLO puede
// elegir de la lista cerrada que se le da — nunca inventa una ruta
// nueva, ver extraerHrefsRecomendados más abajo, que descarta
// cualquier cosa fuera del catálogo.
export function construirPromptRecomendarModulos(
  descripcionNegocio: string,
  catalogo: ModuloCatalogo[]
): string {
  const listaTexto = catalogo
    .map((m) => `- "${m.href}": ${m.nombre} — ${m.descripcion}`)
    .join("\n");

  return (
    "Eres un consultor que configura CoreStock (un sistema de inventario y " +
    "punto de venta) para un negocio pequeño. " +
    `El negocio es: "${descripcionNegocio}". ` +
    "Del siguiente catálogo de módulos disponibles, elige SOLO los que este " +
    "negocio usaría de verdad — ni más (no agregues módulos irrelevantes " +
    "por si acaso) ni menos (no dejes fuera algo que claramente necesita). " +
    "Incluye siempre ventas/cobro y clientes si el negocio trata con clientes. " +
    `Catálogo:\n\n${listaTexto}\n\n` +
    "Responde ÚNICAMENTE con un array JSON de los \"href\" elegidos, por " +
    'ejemplo ["/menu","/clientes","/servicios"] — sin explicación, sin ' +
    "markdown, sin texto antes ni después."
  );
}

// Extrae el array de hrefs de la respuesta del modelo y lo filtra
// contra el catálogo real — si el modelo inventa una ruta que no
// estaba en la lista (o responde cualquier cosa que no sea JSON), esa
// entrada se descarta en vez de colarse a rutas_activas. Un arreglo
// vacío (o que no se pudo interpretar nada) se trata como "no se pudo
// recomendar" — quien llama decide el respaldo.
export function extraerHrefsRecomendados(texto: string, hrefsValidos: string[]): string[] {
  const limpio = texto
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  function normalizar(json: unknown): string[] {
    if (!Array.isArray(json)) return [];
    const validos = new Set(hrefsValidos);
    return json.filter((v): v is string => typeof v === "string" && validos.has(v));
  }

  try {
    const directo = normalizar(JSON.parse(limpio));
    if (directo.length > 0) return directo;
  } catch {
    // sigue abajo
  }

  const inicio = limpio.indexOf("[");
  if (inicio !== -1) {
    let profundidad = 0;
    for (let i = inicio; i < limpio.length; i++) {
      if (limpio[i] === "[") profundidad++;
      else if (limpio[i] === "]") {
        profundidad--;
        if (profundidad === 0) {
          try {
            return normalizar(JSON.parse(limpio.slice(inicio, i + 1)));
          } catch {
            return [];
          }
        }
      }
    }
  }

  return [];
}

// Resumen real del negocio que se le da al modelo como contexto en el
// Asistente. Sin esto respondería bien de negocio en general pero no
// podría decir una sola cifra del negocio de quien pregunta, que es la
// mitad del valor.
export interface ContextoNegocio {
  // Cuando una consulta a la base falla, sus cifras NO se mandan como
  // cero: se marca que no se pudieron leer. Un cero y un "no se pudo
  // leer" son cosas distintas, y confundirlos hace que el modelo afirme
  // con total seguridad "hoy no has vendido nada" cuando lo que pasó es
  // que la consulta falló. Una cifra inventada sobre el propio negocio
  // es lo peor que puede decir este asistente.
  ventasDisponibles: boolean;
  inventarioDisponible: boolean;
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

function listaCorta(nombres: string[], maximo = 8): string {
  if (nombres.length === 0) return "ninguno";
  const visibles = nombres.slice(0, maximo).join(", ");
  return nombres.length > maximo ? `${visibles} (y ${nombres.length - maximo} más)` : visibles;
}

// Prompt de sistema del Asistente — compartido por Groq (texto y, si no
// hay llave de Google, también fotos) y Google AI (fotos, cuando su
// llave está puesta). Vivía duplicado en lib/groq.ts hasta que el
// Asistente ganó la posibilidad de mandar una foto: para que la persona
// obtenga el MISMO asistente (mismo tono, mismos datos, misma mascota)
// sin importar cuál de los dos proveedores atendió esa pregunta en
// particular, el texto se arma en un solo lugar.
export function construirPromptAsistente(contexto: ContextoNegocio, idioma: string): string {
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
    "- Si la persona te manda una foto, descríbela y respóndele sobre lo que ves ahí (un producto, un ticket, lo que sea) combinándolo con los datos del negocio cuando aplique.",
    "",
    "SOBRE LOS NÚMEROS DE ESTE NEGOCIO:",
    "- Los datos de abajo son reales y de hoy. Úsalos cuando pregunten por su negocio.",
    "- NUNCA inventes una cifra que no esté abajo. Si te preguntan algo que los datos no cubren (por ejemplo el detalle de un producto concreto), dilo y di en qué pantalla de CoreStock se ve.",
    "- Si un dato está en cero, puede ser que de verdad sea cero o que aún no lo estén registrando. Menciónalo como posibilidad en vez de dar por hecho que el negocio va mal.",
    "",
    "DATOS ACTUALES:",
    ...(contexto.inventarioDisponible
      ? [
          `- Productos activos: ${contexto.productosActivos}`,
          `- Valor del inventario: ${m}${contexto.valorInventario.toFixed(2)}`,
          `- Productos agotados: ${listaCorta(contexto.agotados)}`,
          `- Productos por debajo del stock mínimo: ${listaCorta(contexto.bajoStock)}`,
        ]
      : [
          "- Inventario: NO SE PUDO LEER en este momento. Si te preguntan por productos, stock o agotados, di que ahora mismo no puedes consultarlo y que lo revisen en la pantalla de Productos. NO digas que no tienen productos.",
        ]),
    ...(contexto.ventasDisponibles
      ? [
          `- Ventas de hoy: ${m}${contexto.ventasHoy.toFixed(2)}`,
          `- Ventas de los últimos 7 días: ${m}${contexto.ventasSemana.toFixed(2)}`,
          `- Ventas de los últimos 30 días: ${m}${contexto.ventasMes.toFixed(2)}`,
          `- Producto más vendido (30 días): ${contexto.productoTop ?? "todavía no hay ventas"}`,
          `- Mejor cliente (30 días): ${contexto.mejorCliente ?? "todavía no hay ventas con cliente"}`,
        ]
      : [
          "- Ventas: NO SE PUDO LEER en este momento. Si te preguntan cuánto vendieron, di que ahora mismo no puedes consultarlo y que lo revisen en la pantalla de Ventas. NUNCA digas que no han vendido nada.",
        ]),
    "",
    "LÍMITES:",
    "- No puedes registrar ventas, cambiar precios ni modificar nada. Solo informas y aconsejas. Si te piden hacer algo, explica en qué pantalla se hace.",
    "- En temas de impuestos, contratos o salud, da la orientación general que sepas y di con claridad cuándo conviene consultar a un profesional.",
    "",
    "COREBOT, TU MASCOTA:",
    "- Eres representado en pantalla por Corebot, un robot animado. Tras escribir tu respuesta completa, agrega una última línea, sola y sin nada más, con el formato exacto `[[emocion:X]]`.",
    "- X es UNA sola palabra de esta lista, la que mejor refleje el tono de lo que acabas de responder: feliz, sorprendido, analizando, concentrado, ayudando, emocionado, durmiendo.",
    "- Usa feliz para una respuesta amable o positiva de rutina; sorprendido ante un dato llamativo o inesperado; analizando cuando estás repasando cifras del negocio; concentrado en un tema serio o técnico; ayudando cuando estás guiando paso a paso; emocionado ante buenas noticias o algo para celebrar; durmiendo si la conversación es de despedida, buenas noches o algo relajado.",
    "- Esa línea es solo una instrucción para animar a Corebot: la persona nunca la ve, así que no la menciones, no la expliques y no la pongas en ningún otro lugar de la respuesta.",
  ].join("\n");
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

