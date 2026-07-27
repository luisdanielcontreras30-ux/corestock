import { normalizarTexto } from "../../lib/normalizarTexto";
import { TEMAS_CONOCIMIENTO } from "./conocimiento";
import { TEMAS_FILOSOFIA } from "./filosofia";

// Los dos bloques de conocimiento se tratan igual: el de finanzas y
// operación (conocimiento.ts) y el de filosofía de negocio, libros y
// psicología oscura (filosofia.ts). Están separados solo por tamaño.
const TODOS_LOS_TEMAS = [...TEMAS_CONOCIMIENTO, ...TEMAS_FILOSOFIA];

// Motor de detección de intención del Asistente.
//
// Antes esto era una cadena de `if (texto.includes(...))`: la primera
// condición que coincidía ganaba, así que el ORDEN de los if decidía la
// respuesta. Eso obligaba a trucos frágiles (revisar "mes" antes que
// "resumen" porque "resumen del mes" contiene ambos) y hacía que
// agregar una intención nueva pudiera romper otra existente sin avisar.
//
// Ahora cada intención declara sus palabras y todas compiten por
// puntaje: gana la de mayor puntuación. Las frases largas pesan más que
// las sueltas ("mas vendido" pesa más que "vend"), así que la intención
// más específica gana sin depender del orden en que esté escrita.

export type IntencionDatos =
  | "que_comprar"
  | "ganancias"
  | "baja_ventas"
  | "resumen_semana"
  | "ventas_hoy"
  | "producto_top"
  | "agotados"
  | "inventario"
  | "mejor_cliente"
  | "ventas_mes"
  | "categoria_top";

export type Resultado =
  | { tipo: "datos"; intencion: IntencionDatos }
  | { tipo: "conocimiento"; temaId: string }
  | { tipo: "saludo" }
  | { tipo: "despedida" }
  | { tipo: "ayuda" }
  | null;

// Palabras que delatan que la persona pregunta por SU negocio (quiere
// un número real) en vez de por el concepto.
const MARCAS_DATOS = [
  "mi ", "mis ", "cuanto llevo", "cuanto vendi", "cuanto gane", "cuanto tengo",
  "como voy", "como va", "tengo ", "llevo ", "my ", "how much did i", "how am i",
  "meu ", "minha ", "mon ", "mein ", "il mio", "我的",
];

// Palabras que delatan que pregunta por el CONCEPTO (quiere que se lo
// expliquen) aunque mencione un término que también es una intención de
// datos. Sin esto, "¿qué es el margen?" caería en "dime mi margen".
const MARCAS_CONCEPTO = [
  "que es", "que son", "que significa", "significa", "como se calcula",
  "como calculo", "como calcular", "explicame", "explica", "definicion",
  "para que sirve", "como funciona", "me explicas", "ensename", "quiero aprender",
  "como puedo", "como hago", "como le hago", "consejos", "recomiendame",
  "what is", "what are", "how do i", "how to", "explain",
  "o que e", "como faco", "qu'est-ce", "comment", "was ist", "wie kann",
  "che cos", "come si", "是什么", "怎么",
];

interface Candidato {
  palabras: string[];
  resultado: Resultado;
}

// Intenciones que consultan los datos reales del negocio. Cada una trae
// muchos sinónimos y formas coloquiales a propósito: la idea es que la
// persona escriba como habla, no como el programa espera.
const CANDIDATOS_DATOS: Candidato[] = [
  {
    resultado: { tipo: "datos", intencion: "que_comprar" },
    palabras: [
      "que comprar", "debo comprar", "tengo que comprar", "que me falta", "hay que comprar",
      "reabastecer", "resurtir", "surtir", "reponer", "que pedir", "lista de compras",
      "what should i buy", "restock", "reabastecer", "o que comprar", "que acheter",
      "was einkaufen", "cosa comprare", "该进什么货",
    ],
  },
  {
    resultado: { tipo: "datos", intencion: "ganancias" },
    palabras: [
      "cuanto gane", "cuanto he ganado", "mis ganancias", "mi ganancia", "mi utilidad",
      "cuanto estoy ganando", "ganancias", "utilidad", "lucro", "mi margen",
      "margen actual", "profit", "earnings", "mes ganhos", "mes benefices",
      "mein gewinn", "i miei guadagni", "我赚了多少",
    ],
  },
  {
    resultado: { tipo: "datos", intencion: "baja_ventas" },
    palabras: [
      "bajaron las ventas", "cayeron las ventas", "estoy vendiendo menos",
      "vendo menos", "menos ventas", "por que baje", "por que bajaron",
      "caida de ventas", "sales dropped", "vendas cairam", "ventes en baisse",
      "umsatz gesunken", "vendite calate", "销量下滑",
    ],
  },
  {
    resultado: { tipo: "datos", intencion: "ventas_mes" },
    palabras: [
      "ventas del mes", "cuanto vendi este mes", "como va el mes", "resumen del mes",
      "ventas mensuales", "este mes", "monthly sales", "this month",
      "vendas do mes", "ventes du mois", "monatsumsatz", "vendite del mese", "本月销售",
    ],
  },
  {
    resultado: { tipo: "datos", intencion: "resumen_semana" },
    palabras: [
      "resumen", "resumen de la semana", "como voy", "como va el negocio",
      "ventas de la semana", "esta semana", "summary", "this week", "weekly",
      "resumo", "resume de la semaine", "wochenubersicht", "riepilogo", "本周",
    ],
  },
  {
    resultado: { tipo: "datos", intencion: "ventas_hoy" },
    palabras: [
      "cuanto vendi hoy", "ventas de hoy", "ventas hoy", "vendi hoy", "hoy",
      "el dia de hoy", "today", "sales today", "vendas de hoje", "ventes du jour",
      "heute", "oggi", "今天卖了",
    ],
  },
  {
    resultado: { tipo: "datos", intencion: "producto_top" },
    palabras: [
      "mas vendido", "el que mas vende", "se vende mas", "producto estrella",
      "mi mejor producto", "que se vende mejor", "best seller", "best selling",
      "top product", "mais vendido", "le plus vendu", "bestseller",
      "piu venduto", "最畅销",
    ],
  },
  {
    resultado: { tipo: "datos", intencion: "categoria_top" },
    palabras: [
      "categoria", "que categoria vende mas", "mejor categoria", "por categoria",
      "category", "categoria mais vendida", "categorie", "kategorie", "哪个品类",
    ],
  },
  {
    resultado: { tipo: "datos", intencion: "agotados" },
    palabras: [
      "agotado", "agotados", "sin stock", "se acabo", "se me acabo", "sin existencia", "esta agotado", "que falta",
      "no tengo producto", "out of stock", "sold out", "esgotado", "en rupture",
      "ausverkauft", "esaurito", "缺货",
    ],
  },
  {
    resultado: { tipo: "datos", intencion: "inventario" },
    palabras: [
      "mi inventario", "como esta mi inventario", "valor del inventario",
      "cuantos productos tengo", "stock total", "mi catalogo", "existencias",
      "my inventory", "meu estoque", "mon stock", "mein lagerbestand",
      "il mio magazzino", "我的库存",
    ],
  },
  {
    resultado: { tipo: "datos", intencion: "mejor_cliente" },
    palabras: [
      "mejor cliente", "mejores clientes", "quien me compra mas", "quien mas me compra",
      "top clientes", "mis mejores clientes", "best customer", "top customer",
      "melhor cliente", "meilleur client", "bester kunde", "miglior cliente", "最好的客户",
    ],
  },
];

const CANDIDATOS_CHARLA: Candidato[] = [
  {
    resultado: { tipo: "ayuda" },
    palabras: [
      "ayuda", "que puedes hacer", "que sabes hacer", "en que me puedes ayudar",
      "que preguntas puedo hacer", "opciones", "help", "what can you do",
      "aide", "hilfe", "aiuto", "ajuda", "帮助",
    ],
  },
  {
    resultado: { tipo: "despedida" },
    palabras: [
      "gracias", "muchas gracias", "adios", "hasta luego", "nos vemos", "bye",
      "thanks", "thank you", "obrigado", "merci", "danke", "grazie", "谢谢",
    ],
  },
];

// Los saludos se tratan aparte: deben coincidir con el mensaje COMPLETO
// (o su inicio), no por contener la palabra. Si no, "hola, ¿cuánto
// vendí hoy?" se quedaría en el saludo en vez de responder la pregunta.
const SALUDOS = [
  "hola", "holi", "buenas", "buenos dias", "buenas tardes", "buenas noches",
  "que tal", "que onda", "hi", "hello", "hey", "oi", "ola", "salut", "hallo",
  "ciao", "你好",
];

function esSaludoSuelto(texto: string): boolean {
  return SALUDOS.some(
    (s) => texto === s || texto.startsWith(s + " ") || texto.startsWith(s + ",") || texto.startsWith(s + "!")
  );
}

// Busca una frase respetando límites de palabra. Hace falta para las
// marcas de concepto/datos: con un includes() a secas, "que es" aparece
// dentro de "que esta agotado" y la pregunta se tomaba como una duda
// conceptual en vez de una consulta de inventario.
function contieneFrase(texto: string, frase: string): boolean {
  let desde = 0;
  for (;;) {
    const i = texto.indexOf(frase, desde);
    if (i === -1) return false;

    const antes = i === 0 ? "" : texto[i - 1];
    const despues = texto[i + frase.length] ?? "";
    const esLetra = (c: string) => c !== "" && /[a-z0-9]/.test(c);

    if (!esLetra(antes) && !esLetra(despues)) return true;
    desde = i + 1;
  }
}

// Puntúa un conjunto de palabras contra el texto. Cada coincidencia
// suma la longitud de la palabra encontrada, de modo que una frase de
// varias palabras pesa mucho más que un fragmento corto que podría
// aparecer por casualidad dentro de otra palabra.
function puntuar(texto: string, palabras: string[]): number {
  let total = 0;
  for (const palabra of palabras) {
    if (texto.includes(palabra)) total += palabra.length;
  }
  return total;
}

// Umbral mínimo: por debajo de esto se considera que no hubo una
// coincidencia real, y es mejor decir "no entendí" que responder
// cualquier cosa por haber pescado tres letras sueltas.
const PUNTAJE_MINIMO = 4;

export function detectarIntencion(entrada: string): Resultado {
  const texto = normalizarTexto(entrada).trim();
  if (!texto) return null;

  const preguntaConcepto = MARCAS_CONCEPTO.some((m) => contieneFrase(texto, m));
  const preguntaDatos = MARCAS_DATOS.some((m) => contieneFrase(texto, m));

  let mejor: Resultado = null;
  let mejorPuntaje = 0;

  // El umbral se mide contra el puntaje CRUDO y el sesgo solo sirve
  // para ordenar entre candidatos. Si el sesgo entrara en la
  // comparación con el umbral, una coincidencia buena podría caer por
  // debajo y devolver "no entendí" solo por cómo estaba redactada
  // ("debo fiar a mis clientes" mencionaba "mis" y se descartaba sola).
  function considerar(crudo: number, sesgo: number, resultado: Resultado) {
    if (crudo < PUNTAJE_MINIMO) return;
    const p = crudo * sesgo;
    if (p > mejorPuntaje) {
      mejorPuntaje = p;
      mejor = resultado;
    }
  }

  for (const c of [...CANDIDATOS_DATOS, ...CANDIDATOS_CHARLA]) {
    // "¿qué es el margen?" y "¿cuál es mi margen?" comparten la palabra
    // clave; lo que las distingue es cómo está formulada la pregunta.
    const sesgo =
      c.resultado?.tipo === "datos" ? (preguntaConcepto ? 0.6 : preguntaDatos ? 1.4 : 1) : 1;
    considerar(puntuar(texto, c.palabras), sesgo, c.resultado);
  }

  for (const tema of TODOS_LOS_TEMAS) {
    const sesgo = preguntaConcepto ? 1.4 : preguntaDatos ? 0.6 : 1;
    considerar(puntuar(texto, tema.palabras), sesgo, { tipo: "conocimiento", temaId: tema.id });
  }

  // El saludo se evalúa AL FINAL y solo si nada más ganó: así "hola,
  // ¿cuánto vendí hoy?" responde la pregunta en vez de quedarse en el
  // "¡hola!", que es lo que hacía antes al revisarlo primero.
  if (!mejor && esSaludoSuelto(texto)) return { tipo: "saludo" };

  return mejor;
}

// Lista de temas disponibles, para armar el mensaje de "no entendí" con
// sugerencias reales en vez de un texto fijo que se queda viejo cada
// vez que se agrega un tema.
export function idsTemasConocimiento(): string[] {
  return TODOS_LOS_TEMAS.map((t) => t.id);
}
