// Compartido por las gráficas de área de Gráficas, el Dashboard y
// Análisis de producto (recharts no tiene un "minPointSize" para
// <Area> como sí tiene para <Bar> — ver minPointSize en cada <Bar> de
// esas páginas, que resuelve el mismo problema ahí).
//
// Cuando un punto es mucho más grande que el resto (ej. una venta
// grande un día entre puros días chicos), una escala lineal deja a los
// valores chicos pegados al piso — se ven como una línea recta en 0
// aunque sí haya datos. Esta función NO cambia los datos reales (que
// se siguen usando en el tooltip, ver "payload" en el formatter de
// cada gráfica): agrega un campo "__visual" con un piso mínimo de
// altura para que la línea/área siempre se note un poco, aunque el
// valor real sea diminuto comparado con el pico.
export function conPisoVisual<T extends object, K extends keyof T>(
  datos: T[],
  campo: K,
  piso = 0.06
): (T & { __visual: number })[] {
  const maximo = datos.reduce((max, d) => Math.max(max, Number(d[campo]) || 0), 0);

  if (maximo <= 0) {
    return datos.map((d) => ({ ...d, __visual: 0 }));
  }

  const minimo = maximo * piso;

  return datos.map((d) => {
    const valor = Number(d[campo]) || 0;
    // Los ceros de verdad (ningún dato ese día) se quedan en 0 — el
    // piso es solo para que un valor que SÍ existe, pero es chico, no
    // se confunda visualmente con un día sin nada.
    return { ...d, __visual: valor > 0 ? Math.max(valor, minimo) : 0 };
  });
}

// Etiquetas compactas para el eje Y de las gráficas de dinero/unidades.
// El gráfico usa un margen izquierdo negativo (margin={{ left: -20 }})
// para que el eje no deje una franja de espacio en blanco cuando está
// oculto — pero eso también le quita espacio al eje cuando SÍ es
// visible, y un número completo como "11111417" no cabe: se corta
// contra el borde izquierdo de la tarjeta. Con "k"/"M" el número entra
// completo sin necesitar más espacio.
export function formatoEjeCompacto(valor: number): string {
  const abs = Math.abs(valor);
  // El umbral de "M" no es 1_000_000 a secas: un valor como 999,999
  // redondea a "1000k" en la rama de abajo (999999/1000 = 999.999,
  // toFixed(0) sube a 1000) — un número tan largo como el que se
  // quería evitar. 995,000 es el punto real donde ese redondeo empieza
  // a pasar ("K" se corre a "1000k"), así que de ahí para arriba ya se
  // pasa a millones.
  if (abs >= 995_000) return `${(valor / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(valor / 1000).toFixed(0)}k`;
  return String(valor);
}
