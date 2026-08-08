import { normalizarTexto } from "../../lib/normalizarTexto";
import { TEMAS_CONOCIMIENTO } from "./conocimiento";
import { TEMAS_FILOSOFIA } from "./filosofia";
import { TEMAS_LIBROS } from "./libros";
import { TEMAS_GENERAL } from "./general";
import { TEMAS_VIDA } from "./vida";
import { interpretarCalculo } from "./calculadora";

// Los cinco bloques de conocimiento se tratan igual; están separados
// solo por tamaño y por tema: finanzas y operación (conocimiento.ts),
// filosofía de negocio y psicología oscura (filosofia.ts), libros
// (libros.ts), dinero y trámites del mundo real (general.ts), y el
// lado humano —clientes, salud, socios, familia— (vida.ts).
export const TODOS_LOS_TEMAS = [
  ...TEMAS_CONOCIMIENTO,
  ...TEMAS_FILOSOFIA,
  ...TEMAS_LIBROS,
  ...TEMAS_GENERAL,
  ...TEMAS_VIDA,
];

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
  // Una cuenta resuelta al vuelo (ver calculadora.ts). No es una
  // respuesta guardada: sale de operar los números que escribió la
  // persona, así que funciona con cifras que nadie previó.
  | { tipo: "calculo"; clave: string; valores: Record<string, number> }
  | { tipo: "saludo" }
  | { tipo: "despedida" }
  | { tipo: "ayuda" }
  | { tipo: "identidad" }
  | { tipo: "estado_animo" }
  // Conversación que no pide información: alguien que está mal, alguien
  // que celebra, alguien que pide una opinión o un chiste. Responder
  // "no entendí" a "me está yendo pésimo" es lo que hace que un
  // asistente se sienta una máquina.
  | { tipo: "desahogo" }
  | { tipo: "celebracion" }
  | { tipo: "opinion" }
  | { tipo: "chiste" }
  | { tipo: "afecto" }
  // Se refiere al tema anterior ("cuéntame más", "y eso cómo lo aplico"):
  // sin memoria de la conversación esto no significaba nada y caía en
  // "no entendí", que es lo que rompía la sensación de estar hablando
  // con alguien.
  | { tipo: "seguimiento" }
  // Nada coincidió con claridad, pero hay temas parecidos que ofrecer
  // en vez de un "no entendí" seco.
  | { tipo: "sugerencia"; temaIds: string[] }
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
    resultado: { tipo: "identidad" },
    palabras: [
      "quien eres", "que eres", "eres una ia", "eres un robot", "eres humano",
      "como te llamas", "quien te hizo", "who are you", "are you ai",
      "quem e voce", "qui es tu", "wer bist du", "chi sei", "你是谁",
    ],
  },
  {
    resultado: { tipo: "estado_animo" },
    palabras: [
      "como estas", "como te va", "que tal estas", "how are you",
      "como voce esta", "comment vas tu", "wie geht es dir", "come stai", "你好吗",
    ],
  },
  {
    resultado: { tipo: "seguimiento" },
    palabras: [
      "cuentame mas", "dime mas", "mas informacion", "profundiza", "sigue",
      "y eso", "un ejemplo", "dame un ejemplo", "por ejemplo", "como lo aplico",
      "no entiendi", "no entendi", "explicalo mas simple", "mas sencillo",
      "tell me more", "an example", "mais um exemplo", "un exemple",
      "mehr dazu", "un esempio", "再多说点", "举个例子",
    ],
  },
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
  {
    // Va antes que cualquier tema: quien escribe "estoy harto" no busca
    // un artículo sobre agotamiento, busca que alguien lo registre
    // primero. La respuesta ofrece el tema después, no en lugar de.
    resultado: { tipo: "desahogo" },
    palabras: [
      "estoy mal", "me siento mal", "estoy triste", "estoy harto", "estoy harta",
      "ya no puedo mas", "estoy desesperado", "estoy desesperada", "tengo miedo",
      "estoy preocupado", "estoy preocupada", "me va mal", "me esta yendo mal",
      "todo va mal", "estoy solo", "estoy sola", "nadie me ayuda", "estoy quebrado",
      "i feel bad", "im struggling", "estou mal", "je vais mal", "mir geht es schlecht",
      "sto male", "我很难受",
    ],
  },
  {
    resultado: { tipo: "celebracion" },
    palabras: [
      "feliz", "contento", "contenta", "que bueno", "excelente noticia", "me fue bien", "vendi mucho",
      "mejor mes", "lo logre", "buenas noticias", "me fue muy bien",
      "im happy", "great news", "estou feliz", "je suis content", "ich bin froh",
      "sono felice", "我很高兴",
    ],
  },
  {
    resultado: { tipo: "opinion" },
    palabras: [
      "que opinas", "que piensas", "que harias tu", "tu que crees", "que me recomiendas tu",
      "cual es tu opinion", "estas de acuerdo", "what do you think", "your opinion",
      "o que voce acha", "qu'en penses tu", "was denkst du", "cosa ne pensi", "你怎么看",
    ],
  },
  {
    resultado: { tipo: "chiste" },
    palabras: [
      "un chiste", "cuentame un chiste", "hazme reir", "algo gracioso", "dime algo divertido",
      "a joke", "tell me a joke", "uma piada", "une blague", "ein witz", "una barzelletta", "讲个笑话",
    ],
  },
  {
    resultado: { tipo: "afecto" },
    palabras: [
      "te quiero", "eres el mejor", "me caes bien", "eres genial", "me sirves mucho",
      "eres util", "gracias por todo", "i love you", "you are the best",
      "voce e o melhor", "tu es le meilleur", "du bist der beste", "sei il migliore", "你最棒",
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

// Distancia de edición con corte temprano: en cuanto se sabe que
// supera el máximo tolerado, deja de calcular. Importa porque esto se
// llama miles de veces en el barrido de erratas.
function distancia(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    let mejorFila = i;

    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(actual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + costo);
      actual.push(v);
      if (v < mejorFila) mejorFila = v;
    }

    // Toda la fila ya supera el máximo: ninguna continuación puede bajar.
    if (mejorFila > max) return max + 1;
    anterior = actual;
  }

  return anterior[b.length];
}

// Cuántas letras de más se perdonan según lo larga que sea la palabra.
// En una palabra de 4 letras, un error cambia demasiado el significado
// ("caja" y "cara"); en una de 10, casi nunca.
function toleranciaPara(palabra: string): number {
  if (palabra.length >= 8) return 2;
  if (palabra.length >= 5) return 1;
  return 0;
}

// Vocabulario por tema para el barrido de erratas: cada palabra
// significativa que aparece en sus claves, incluidas las que viven
// dentro de una frase.
//
// Ese último detalle no es un adorno. Casi todas las claves de la base
// son frases ("que es el margen", "margen de ganancia") y ninguna es la
// palabra suelta "margen": comparando solo claves de una palabra, el
// barrido no tenía nada contra qué medir justo en los temas más
// buscados, y "margem" seguía cayendo en "no entendí".
//
// Se calcula una sola vez, la primera vez que hace falta.
let vocabularioTemas: { id: string; palabras: string[] }[] | null = null;

function obtenerVocabulario() {
  if (!vocabularioTemas) {
    vocabularioTemas = TODOS_LOS_TEMAS.map((tema) => {
      const palabras = new Set<string>();
      for (const clave of tema.palabras) {
        for (const palabra of clave.split(/[^a-z0-9]+/)) {
          if (palabra.length >= 5) palabras.add(palabra);
        }
      }
      return { id: tema.id, palabras: [...palabras] };
    });
  }
  return vocabularioTemas;
}

// Último recurso cuando nada coincidió: la gente escribe rápido y desde
// el celular, y "margem", "rotasion" o "equilibrrio" no deberían
// terminar en "no entendí" cuando el tema está clarísimo.
function temaPorErrata(texto: string): string | null {
  const palabrasTexto = texto.split(/[^a-z0-9]+/).filter((p) => p.length >= 5);
  if (palabrasTexto.length === 0) return null;

  let mejorId: string | null = null;
  let mejorPuntaje = 0;

  for (const tema of obtenerVocabulario()) {
    let puntaje = 0;

    for (const clave of tema.palabras) {
      const max = toleranciaPara(clave);
      if (max === 0) continue;

      for (const palabra of palabrasTexto) {
        // La coincidencia exacta ya la habría pescado puntuar(); aquí
        // solo interesa lo que está escrito casi bien.
        if (palabra === clave) continue;
        if (distancia(palabra, clave, max) <= max) {
          puntaje += clave.length;
          break;
        }
      }
    }

    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorId = tema.id;
    }
  }

  return mejorPuntaje >= PUNTAJE_MINIMO ? mejorId : null;
}

export function detectarIntencion(entrada: string): Resultado {
  const texto = normalizarTexto(entrada).trim();
  if (!texto) return null;

  // Las cuentas se atienden primero y salen enseguida si no hay dígitos.
  // Van antes que todo lo demás porque son inequívocas: "cuanto es 15%
  // de 2500" no se parece a ninguna otra intención.
  const calculo = interpretarCalculo(texto);
  if (calculo) {
    return { tipo: "calculo", clave: calculo.clave, valores: calculo.valores };
  }

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

  // Nada superó el umbral. Antes de rendirse, dos intentos más:
  if (!mejor) {
    // 1. ¿Será que solo está mal escrito? Se responde de verdad, no se
    //    sugiere: si "cuanto es la rotasion de inventario" se entiende
    //    perfectamente, ofrecer una lista sería peor que contestar.
    const conErrata = temaPorErrata(texto);
    if (conErrata) return { tipo: "conocimiento", temaId: conErrata };

    // 2. ¿Hay temas que comparten alguna palabra con lo que escribió?
    //    Ofrecerlos es mucho más útil que un "no entendí" seco, y es lo
    //    que hace que la persona descubra de qué más se puede hablar.
    const sugerencias = temasParecidos(texto);
    if (sugerencias.length > 0) return { tipo: "sugerencia", temaIds: sugerencias };
  }

  return mejor;
}

// Busca temas que compartan alguna palabra significativa con el texto,
// con un listón mucho más bajo que la detección normal. Solo se usa
// para sugerir, nunca para responder como si se hubiera entendido.
function temasParecidos(texto: string): string[] {
  const palabrasTexto = texto.split(/[^a-z0-9]+/).filter((p) => p.length >= 4);
  if (palabrasTexto.length === 0) return [];

  const puntuados = TODOS_LOS_TEMAS.map((tema) => {
    let p = 0;
    for (const palabra of palabrasTexto) {
      if (tema.palabras.some((k) => k.includes(palabra))) p++;
    }
    return { id: tema.id, p };
  })
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p);

  return puntuados.slice(0, 3).map((x) => x.id);
}

// Lista de temas disponibles, para armar el mensaje de "no entendí" con
// sugerencias reales en vez de un texto fijo que se queda viejo cada
// vez que se agrega un tema.
export function idsTemasConocimiento(): string[] {
  return TODOS_LOS_TEMAS.map((t) => t.id);
}
