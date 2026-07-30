// Contraste entre dos colores, para avisar cuando una combinación deja
// el texto ilegible.
//
// Hace falta porque la apariencia del catálogo dejó de tener un solo
// color: hoy se pueden elegir el fondo de la página, el de la tarjeta,
// el nombre del producto, el precio y los botones por separado. Con esa
// libertad, poner un fondo claro y dejar el texto en blanco es un
// accidente de dos clics — y el resultado no lo sufre quien configura,
// que ya sabe lo que puso, sino el cliente que abre el catálogo desde su
// teléfono y no ve los precios.
//
// La fórmula es la de WCAG 2.1 (luminancia relativa y razón de
// contraste). No se inventa nada: es el mismo cálculo que usan las
// herramientas de accesibilidad.

const HEX = /^#[0-9a-fA-F]{6}$/;

function canalLineal(valor255: number): number {
  const s = valor255 / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminanciaRelativa(hex: string): number | null {
  if (!HEX.test(hex)) return null;

  const r = canalLineal(parseInt(hex.slice(1, 3), 16));
  const g = canalLineal(parseInt(hex.slice(3, 5), 16));
  const b = canalLineal(parseInt(hex.slice(5, 7), 16));

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Razón de contraste entre 1 (idénticos) y 21 (negro sobre blanco).
// null cuando alguno de los dos no es un hex válido: sin colores no hay
// nada que comparar, y devolver un número inventado haría que la
// pantalla avisara de un problema que no puede saber si existe.
export function razonDeContraste(a: string, b: string): number | null {
  const la = luminanciaRelativa(a);
  const lb = luminanciaRelativa(b);
  if (la === null || lb === null) return null;

  const claro = Math.max(la, lb);
  const oscuro = Math.min(la, lb);
  return (claro + 0.05) / (oscuro + 0.05);
}

// Umbral deliberadamente permisivo. WCAG pide 4.5 para texto normal,
// pero avisar a 4.5 marcaría como problema combinaciones que se leen
// perfectamente bien y acabaría ignorándose por ruidosa. A menos de 3 el
// texto ya no se lee de un vistazo en un celular a la luz del día, y eso
// sí vale interrumpir.
export const CONTRASTE_MINIMO = 3;

export function contrasteInsuficiente(texto: string, fondo: string): boolean {
  const razon = razonDeContraste(texto, fondo);
  return razon !== null && razon < CONTRASTE_MINIMO;
}
