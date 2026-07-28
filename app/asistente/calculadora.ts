// Calculadora en lenguaje natural del Asistente.
//
// Todo lo demás en esta carpeta busca una respuesta ya escrita. Esto no:
// aquí la respuesta se CALCULA, así que funciona con números que nadie
// previó. "¿cuánto es el 18% de 4,350?" o "compro a 37 y vendo a 89,
// ¿cuánto gano?" no están en ninguna lista y aun así se responden bien.
//
// Devuelve la clave de una plantilla de i18n más los números que van en
// sus huecos, en vez de texto armado aquí — así la respuesta sale en los
// 7 idiomas sin que este archivo sepa nada de idiomas.

export interface Calculo {
  clave: string;
  valores: Record<string, number>;
}

// ---------------------------------------------------------------------
// Lectura de números escritos como los escribe la gente
// ---------------------------------------------------------------------

// "2,500" / "2.500" / "2500.50" / "1,234.56" son todos válidos y todos
// distintos según el país. La regla: si hay dos separadores, el último
// manda; si hay uno solo con exactamente 3 dígitos detrás, son miles.
function parsearNumero(bruto: string): number {
  let s = bruto.replace(/\s/g, "");

  const coma = s.lastIndexOf(",");
  const punto = s.lastIndexOf(".");

  if (coma !== -1 && punto !== -1) {
    if (coma > punto) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (coma !== -1) {
    const partes = s.split(",");
    if (partes.length === 2 && partes[1].length === 3) s = s.replace(",", "");
    else s = s.replace(/,/g, ".");
  } else if (punto !== -1) {
    const partes = s.split(".");
    // "2.500" en español son dos mil quinientos; "2.5" es dos y medio.
    if (partes.length === 2 && partes[1].length === 3 && partes[0].length <= 3) {
      s = s.replace(".", "");
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const NUM = "([0-9][0-9.,]*)";

// ---------------------------------------------------------------------
// Evaluador aritmético (sin eval)
// ---------------------------------------------------------------------

type Token =
  | { t: "num"; v: number }
  | { t: "op"; v: "+" | "-" | "*" | "/" }
  | { t: "par"; v: "(" | ")" };

// Se traducen las palabras a símbolos antes de tokenizar para que
// "120 mas 30 por 2" y "120 + 30 * 2" sean la misma cuenta.
const PALABRAS_OPERADOR: [RegExp, string][] = [
  [/\b(mas|plus|piu|plus|und|加)\b/g, "+"],
  [/\b(menos|minus|moins|weniger|meno|减)\b/g, "-"],
  [/\b(por|times|vezes|fois|mal|per|乘)\b/g, "*"],
  [/\b(entre|dividido entre|dividido|divided by|dividir|geteilt|diviso|除)\b/g, "/"],
  [/[x×]/g, "*"],
  [/[÷:]/g, "/"],
];

function tokenizar(texto: string): Token[] | null {
  let s = texto;
  for (const [re, simbolo] of PALABRAS_OPERADOR) s = s.replace(re, simbolo);

  const tokens: Token[] = [];
  let i = 0;

  while (i < s.length) {
    const c = s[i];

    if (c === " ") {
      i++;
      continue;
    }

    if (c === "(" || c === ")") {
      tokens.push({ t: "par", v: c });
      i++;
      continue;
    }

    if (c === "+" || c === "-" || c === "*" || c === "/") {
      tokens.push({ t: "op", v: c });
      i++;
      continue;
    }

    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.,]/.test(s[j])) j++;
      // Una coma o punto final ("30, y luego...") no es parte del número.
      let bruto = s.slice(i, j);
      while (bruto.length > 0 && /[.,]/.test(bruto[bruto.length - 1])) {
        bruto = bruto.slice(0, -1);
        j--;
      }
      const n = parsearNumero(bruto);
      if (Number.isNaN(n)) return null;
      tokens.push({ t: "num", v: n });
      i = j;
      continue;
    }

    // Cualquier otra cosa (una letra suelta, un signo raro) descalifica
    // el texto como cuenta: mejor no responder que inventar un número.
    return null;
  }

  return tokens;
}

// Descenso recursivo clásico: expr → term → factor. Nada de eval(), que
// además de inseguro ejecutaría cualquier cosa que escriba la persona.
function evaluar(tokens: Token[]): number | null {
  let pos = 0;

  function expr(): number | null {
    let izq = term();
    if (izq === null) return null;

    while (pos < tokens.length) {
      const tk = tokens[pos];
      if (tk.t !== "op" || (tk.v !== "+" && tk.v !== "-")) break;
      pos++;
      const der = term();
      if (der === null) return null;
      izq = tk.v === "+" ? izq + der : izq - der;
    }

    return izq;
  }

  function term(): number | null {
    let izq = factor();
    if (izq === null) return null;

    while (pos < tokens.length) {
      const tk = tokens[pos];
      if (tk.t !== "op" || (tk.v !== "*" && tk.v !== "/")) break;
      pos++;
      const der = factor();
      if (der === null) return null;
      if (tk.v === "/") {
        if (der === 0) return null;
        izq = izq / der;
      } else {
        izq = izq * der;
      }
    }

    return izq;
  }

  function factor(): number | null {
    const tk = tokens[pos];
    if (!tk) return null;

    if (tk.t === "op" && tk.v === "-") {
      pos++;
      const v = factor();
      return v === null ? null : -v;
    }

    if (tk.t === "num") {
      pos++;
      return tk.v;
    }

    if (tk.t === "par" && tk.v === "(") {
      pos++;
      const v = expr();
      if (v === null) return null;
      const cierra = tokens[pos];
      if (!cierra || cierra.t !== "par" || cierra.v !== ")") return null;
      pos++;
      return v;
    }

    return null;
  }

  const valor = expr();
  if (valor === null || pos !== tokens.length) return null;
  return Number.isFinite(valor) ? valor : null;
}

// ---------------------------------------------------------------------
// Patrones de negocio
// ---------------------------------------------------------------------

// Palabras que marcan el costo y el precio de venta en una frase suelta
// como "me cuesta 30 y lo vendo en 50".
const COSTO = "(?:cuesta|me cuesta|compro|compre|pago|pague|costo|coste|me sale|cost|custa|coute|kostet|costa)";
const VENTA = "(?:vendo|vendi|venderlo|lo vendo|precio de venta|precio|vender|sell|vendo a|vendendo|vends|verkaufe)";

function buscar(texto: string, patron: string): RegExpMatchArray | null {
  return texto.match(new RegExp(patron));
}

// Cada intento devuelve null si no aplica; el primero que reconoce la
// frase gana. Van de lo más específico a lo más general a propósito: la
// aritmética suelta es la última porque casi cualquier cosa con números
// y un signo encaja en ella.
export function interpretarCalculo(texto: string): Calculo | null {
  // Sin ningún dígito no hay nada que calcular. Sale rápido para que
  // esto no cueste nada en la inmensa mayoría de las preguntas.
  if (!/[0-9]/.test(texto)) return null;

  // --- Punto de equilibrio -------------------------------------------
  if (/equilibrio|break ?even|equilibrio|pareggio|gewinnschwelle|平衡/.test(texto)) {
    const numeros = [...texto.matchAll(new RegExp(NUM, "g"))]
      .map((m) => parsearNumero(m[1]))
      .filter((n) => !Number.isNaN(n));

    if (numeros.length >= 3) {
      const [fijos, precio, costo] = numeros;
      const margenUnidad = precio - costo;
      if (margenUnidad <= 0) {
        return { clave: "asistente.calc_equilibrio_imposible", valores: { p: precio, c: costo } };
      }
      return {
        clave: "asistente.calc_equilibrio",
        valores: {
          f: fijos,
          p: precio,
          c: costo,
          g: margenUnidad,
          u: Math.ceil(fijos / margenUnidad),
        },
      };
    }
  }

  // --- Precio a partir de costo + margen deseado ----------------------
  const objetivo =
    buscar(texto, `${COSTO}\\D{0,15}${NUM}\\D{0,40}${NUM}\\s*%\\s*(?:de\\s+)?(?:margen|ganancia|margin|profit)`) ??
    buscar(texto, `(?:margen|ganancia|margin)\\D{0,15}${NUM}\\s*%\\D{0,30}${COSTO}\\D{0,15}${NUM}`);

  if (objetivo) {
    // El segundo patrón trae los números al revés que el primero.
    const esInverso = /^(?:margen|ganancia|margin)/.test(texto.trim());
    const costo = parsearNumero(esInverso ? objetivo[2] : objetivo[1]);
    const margen = parsearNumero(esInverso ? objetivo[1] : objetivo[2]);

    if (!Number.isNaN(costo) && !Number.isNaN(margen) && margen > 0 && margen < 100) {
      const precio = costo / (1 - margen / 100);
      return {
        clave: "asistente.calc_precio_objetivo",
        valores: { c: costo, m: margen, p: precio, g: precio - costo },
      };
    }
  }

  // --- Margen a partir de costo y precio ------------------------------
  const margenDirecto =
    buscar(texto, `${COSTO}\\D{0,15}${NUM}\\D{0,30}${VENTA}\\D{0,15}${NUM}`) ??
    buscar(texto, `${VENTA}\\D{0,15}${NUM}\\D{0,30}${COSTO}\\D{0,15}${NUM}`);

  if (margenDirecto) {
    const primeroEsCosto = new RegExp(`^\\D{0,20}${COSTO}`).test(texto);
    const costo = parsearNumero(primeroEsCosto ? margenDirecto[1] : margenDirecto[2]);
    const precio = parsearNumero(primeroEsCosto ? margenDirecto[2] : margenDirecto[1]);

    if (!Number.isNaN(costo) && !Number.isNaN(precio) && costo > 0 && precio > 0) {
      const ganancia = precio - costo;
      return {
        clave: ganancia >= 0 ? "asistente.calc_margen" : "asistente.calc_margen_perdida",
        valores: {
          c: costo,
          p: precio,
          g: ganancia,
          m: (ganancia / precio) * 100,
          k: (ganancia / costo) * 100,
        },
      };
    }
  }

  // --- Variación entre dos números ------------------------------------
  const variacion = buscar(
    texto,
    `(?:de|from|von|da|di)\\s*${NUM}\\s*(?:a|to|hasta|para|auf|zu)\\s*${NUM}`
  );

  if (variacion && /subio|bajo|cambio|vario|aumento|crecio|cayo|paso|porcentaje|%|increase|decrease|change/.test(texto)) {
    const desde = parsearNumero(variacion[1]);
    const hasta = parsearNumero(variacion[2]);

    if (!Number.isNaN(desde) && !Number.isNaN(hasta) && desde !== 0) {
      const cambio = ((hasta - desde) / Math.abs(desde)) * 100;
      return {
        clave: cambio >= 0 ? "asistente.calc_variacion_sube" : "asistente.calc_variacion_baja",
        valores: { a: desde, b: hasta, r: Math.abs(cambio), d: Math.abs(hasta - desde) },
      };
    }
  }

  // --- Qué porcentaje representa un número de otro --------------------
  const quePorcentaje =
    buscar(texto, `${NUM}\\s*(?:es|son|is|e)?\\s*(?:que|cual|what)\\s*(?:%|porcentaje|percent|porcento)\\s*(?:de|of|do)\\s*${NUM}`) ??
    buscar(texto, `(?:que|cual|what)\\s*(?:%|porcentaje|percent|porcento)\\s*(?:es|son|is)?\\s*${NUM}\\s*(?:de|of|do)\\s*${NUM}`);

  if (quePorcentaje) {
    const parte = parsearNumero(quePorcentaje[1]);
    const total = parsearNumero(quePorcentaje[2]);

    if (!Number.isNaN(parte) && !Number.isNaN(total) && total !== 0) {
      return {
        clave: "asistente.calc_que_porcentaje",
        valores: { a: parte, b: total, r: (parte / total) * 100 },
      };
    }
  }

  // --- Sumar o restar un porcentaje -----------------------------------
  const sumaPct =
    buscar(texto, `${NUM}\\s*(?:mas|\\+|con|plus|und)\\s*${NUM}\\s*%`) ??
    buscar(texto, `(?:sumale|agregale|subele|aumentale|add)\\s*(?:el\\s*)?${NUM}\\s*%\\s*(?:a|al|to)\\s*${NUM}`);

  if (sumaPct) {
    const inverso = /^(?:sumale|agregale|subele|aumentale|add)/.test(texto.trim());
    const base = parsearNumero(inverso ? sumaPct[2] : sumaPct[1]);
    const pct = parsearNumero(inverso ? sumaPct[1] : sumaPct[2]);

    if (!Number.isNaN(base) && !Number.isNaN(pct)) {
      const diferencia = (base * pct) / 100;
      return {
        clave: "asistente.calc_sumar_pct",
        valores: { a: pct, b: base, d: diferencia, r: base + diferencia },
      };
    }
  }

  const restaPct =
    buscar(texto, `${NUM}\\s*(?:menos|-)\\s*${NUM}\\s*%`) ??
    buscar(texto, `(?:quitale|restale|bajale|descuento de|descuenta|menos)\\s*(?:el\\s*)?${NUM}\\s*%\\s*(?:a|al|de|sobre|to)\\s*${NUM}`);

  if (restaPct) {
    const inverso = /^(?:quitale|restale|bajale|descuento|descuenta|menos)/.test(texto.trim());
    const base = parsearNumero(inverso ? restaPct[2] : restaPct[1]);
    const pct = parsearNumero(inverso ? restaPct[1] : restaPct[2]);

    if (!Number.isNaN(base) && !Number.isNaN(pct)) {
      const diferencia = (base * pct) / 100;
      return {
        clave: "asistente.calc_restar_pct",
        valores: { a: pct, b: base, d: diferencia, r: base - diferencia },
      };
    }
  }

  // --- Porcentaje de un número ----------------------------------------
  const pctDe = buscar(texto, `${NUM}\\s*(?:%|por ?ciento|percent|porcento|prozent|per ?cento)\\s*(?:de|del|of|do|da|von|di|sur)\\s*${NUM}`);

  if (pctDe) {
    const pct = parsearNumero(pctDe[1]);
    const base = parsearNumero(pctDe[2]);

    if (!Number.isNaN(pct) && !Number.isNaN(base)) {
      return {
        clave: "asistente.calc_porcentaje_de",
        valores: { a: pct, b: base, r: (base * pct) / 100 },
      };
    }
  }

  // --- Aritmética suelta ----------------------------------------------
  // Se limpia el envoltorio conversacional ("cuánto es...", "¿...?") y
  // lo que queda tiene que ser una cuenta ENTERA. Si sobra cualquier
  // palabra, tokenizar() devuelve null y no se responde: es preferible
  // no entender a contestar un número sacado de una frase a medias.
  const limpio = texto
    .replace(/^\s*(?:cuanto es|cuanto son|cuanto da|calcula|calcular|dime cuanto es|how much is|whats|what is|quanto e|combien font|wie viel ist|quanto fa)\s*/, "")
    .replace(/[¿?¡!]/g, "")
    .trim();

  if (/[+\-*/x×÷]|\b(mas|menos|por|entre|dividido|plus|minus|times|divided)\b/.test(limpio)) {
    const tokens = tokenizar(limpio);
    if (tokens) {
      const valor = evaluar(tokens);
      if (valor !== null) {
        return { clave: "asistente.calc_resultado", valores: { r: valor } };
      }
    }
  }

  return null;
}
