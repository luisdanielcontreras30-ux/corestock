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
