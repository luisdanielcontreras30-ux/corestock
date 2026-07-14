import { supabase } from "../../lib/supabase";

interface ProductoRaw {
  id: number;
  nombre: string;
  precio_venta: number;
  costo: number | null;
  stock: number;
  stock_minimo: number | null;
  categoria: string;
}

interface VentaRaw {
  id: number;
  producto: string;
  cantidad: number;
  total: number;
  fecha: string;
  cliente_id: number | null;
}

interface ClienteRaw {
  id: number;
  nombre: string;
}

async function obtenerDatos(userId: string) {
  const [{ data: productos }, { data: ventas }, { data: clientes }] = await Promise.all([
    supabase.from("productos").select("*").eq("user_id", userId),
    supabase.from("ventas").select("*").eq("user_id", userId),
    supabase.from("clientes").select("id, nombre").eq("user_id", userId),
  ]);

  return {
    productos: (productos ?? []) as ProductoRaw[],
    ventas: (ventas ?? []) as VentaRaw[],
    clientes: (clientes ?? []) as ClienteRaw[],
  };
}

// Límite superior exclusivo: evita que una venta justo en el borde entre
// dos rangos consecutivos (ej. inicio de "esta semana" == fin de "semana
// anterior") se cuente en ambos.
function ventasEnRango(ventas: VentaRaw[], desde: Date, hasta: Date): VentaRaw[] {
  return ventas.filter((v) => {
    const f = new Date(v.fecha);
    return f >= desde && f < hasta;
  });
}

function unidadesPorProducto(ventas: VentaRaw[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const v of ventas) {
    mapa.set(v.producto, (mapa.get(v.producto) ?? 0) + Number(v.cantidad));
  }
  return mapa;
}

function ingresosPorProducto(ventas: VentaRaw[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const v of ventas) {
    mapa.set(v.producto, (mapa.get(v.producto) ?? 0) + Number(v.total));
  }
  return mapa;
}

// ----------------- 1. ¿QUÉ PRODUCTOS DEBO COMPRAR? -----------------

export async function analizarQueComprar(userId: string): Promise<string> {
  const { productos, ventas } = await obtenerDatos(userId);

  const hoy = new Date();
  const hace30 = new Date(hoy);
  hace30.setDate(hoy.getDate() - 30);

  const ventasRecientes = ventasEnRango(ventas, hace30, hoy);
  const velocidad = unidadesPorProducto(ventasRecientes);

  const bajos = productos.filter((p) => p.stock <= (p.stock_minimo ?? 5));

  if (bajos.length === 0) {
    return "✅ No tienes productos por debajo de su stock mínimo en este momento. No necesitas comprar nada urgente.";
  }

  const conVelocidad = bajos
    .map((p) => ({
      nombre: p.nombre,
      stock: p.stock,
      vendidos30dias: velocidad.get(p.nombre) ?? 0,
    }))
    .sort((a, b) => b.vendidos30dias - a.vendidos30dias);

  const lineas = conVelocidad
    .slice(0, 6)
    .map((p, i) => {
      const urgencia =
        p.vendidos30dias > 0
          ? `se vendieron ${p.vendidos30dias} unidades en los últimos 30 días`
          : "sin ventas registradas en 30 días";
      return `${i + 1}. **${p.nombre}** — quedan ${p.stock}, ${urgencia}.`;
    })
    .join("\n");

  const prioritarios = conVelocidad.filter((p) => p.vendidos30dias > 0);

  const conclusion =
    prioritarios.length > 0
      ? `\n\nPrioriza primero **${prioritarios[0].nombre}** — es el que más se está vendiendo y menos stock le queda.`
      : "\n\nNinguno de estos productos con stock bajo se ha vendido en 30 días — antes de reabastecer, revisa si todavía tienen demanda.";

  return `Tienes ${bajos.length} producto(s) con stock bajo:\n\n${lineas}${conclusion}`;
}

// ----------------- 2. ¿QUÉ PRODUCTOS DEJAN MÁS GANANCIAS? -----------------

export async function analizarGanancias(userId: string): Promise<string> {
  const { productos, ventas } = await obtenerDatos(userId);

  const hoy = new Date();
  const hace30 = new Date(hoy);
  hace30.setDate(hoy.getDate() - 30);

  const ventasRecientes = ventasEnRango(ventas, hace30, hoy);
  const unidades = unidadesPorProducto(ventasRecientes);

  const tieneCostos = productos.some((p) => Number(p.costo) > 0);

  const calculados = productos
    .map((p) => {
      const vendidos = unidades.get(p.nombre) ?? 0;
      const margenUnitario = Number(p.precio_venta) - Number(p.costo ?? 0);
      const gananciaTotal = margenUnitario * vendidos;
      return { nombre: p.nombre, vendidos, margenUnitario, gananciaTotal };
    })
    .filter((p) => p.vendidos > 0)
    .sort((a, b) => b.gananciaTotal - a.gananciaTotal);

  if (calculados.length === 0) {
    return "No hay ventas registradas en los últimos 30 días para calcular ganancias.";
  }

  const lineas = calculados
    .slice(0, 6)
    .map(
      (p, i) =>
        `${i + 1}. **${p.nombre}** — $${p.gananciaTotal.toFixed(2)} de ganancia (${p.vendidos} unidades, margen de $${p.margenUnitario.toFixed(2)} c/u).`
    )
    .join("\n");

  const aviso = !tieneCostos
    ? "\n\n⚠️ No has registrado el costo de tus productos (todos están en $0), así que esto en realidad es tu **ingreso**, no tu ganancia real. Ve a Productos y agrega el costo de cada uno para que este cálculo sea preciso."
    : "";

  return `Ganancia estimada por producto (últimos 30 días):\n\n${lineas}${aviso}`;
}

// ----------------- 3. ¿POR QUÉ BAJARON MIS VENTAS? -----------------

export async function analizarBajaVentas(userId: string): Promise<string> {
  const { ventas } = await obtenerDatos(userId);

  const hoy = new Date();
  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(hoy.getDate() - 7);
  const inicioSemanaAnterior = new Date(hoy);
  inicioSemanaAnterior.setDate(hoy.getDate() - 14);

  const semanaActual = ventasEnRango(ventas, inicioSemana, hoy);
  const semanaAnterior = ventasEnRango(ventas, inicioSemanaAnterior, inicioSemana);

  const totalActual = semanaActual.reduce((sum, v) => sum + Number(v.total), 0);
  const totalAnterior = semanaAnterior.reduce((sum, v) => sum + Number(v.total), 0);

  if (totalAnterior === 0) {
    return "No tengo suficientes ventas de la semana pasada para comparar todavía.";
  }

  const cambio = ((totalActual - totalAnterior) / totalAnterior) * 100;

  if (cambio >= 0) {
    return `Buenas noticias: tus ventas **subieron ${cambio.toFixed(1)}%** esta semana ($${totalActual.toFixed(2)}) comparado con la semana pasada ($${totalAnterior.toFixed(2)}). No bajaron.`;
  }

  const ingresosActual = ingresosPorProducto(semanaActual);
  const ingresosAnterior = ingresosPorProducto(semanaAnterior);

  const caidas = Array.from(ingresosAnterior.entries())
    .map(([nombre, montoAnterior]) => {
      const montoActual = ingresosActual.get(nombre) ?? 0;
      return { nombre, caida: montoAnterior - montoActual };
    })
    .filter((p) => p.caida > 0)
    .sort((a, b) => b.caida - a.caida)
    .slice(0, 3);

  const detalleProductos =
    caidas.length > 0
      ? `\n\nLos productos que más cayeron:\n${caidas
          .map((p, i) => `${i + 1}. **${p.nombre}** — $${p.caida.toFixed(2)} menos que la semana pasada.`)
          .join("\n")}`
      : "";

  return `Tus ventas **bajaron ${Math.abs(cambio).toFixed(1)}%** esta semana ($${totalActual.toFixed(2)}) comparado con la semana pasada ($${totalAnterior.toFixed(2)}).${detalleProductos}`;
}

// ----------------- 5. VENTAS DE HOY -----------------

export async function analizarVentasHoy(userId: string): Promise<string> {
  const { ventas } = await obtenerDatos(userId);

  const hoy = new Date();
  const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const finDia = new Date(inicioDia);
  finDia.setDate(finDia.getDate() + 1);

  const ventasHoy = ventasEnRango(ventas, inicioDia, finDia);
  const total = ventasHoy.reduce((sum, v) => sum + Number(v.total), 0);

  if (ventasHoy.length === 0) {
    return "Todavía no tienes ventas registradas el día de hoy.";
  }

  const unidades = ventasHoy.reduce((sum, v) => sum + Number(v.cantidad), 0);

  return `Hoy llevas **$${total.toFixed(2)}** en ventas, repartidos en ${ventasHoy.length} transacción(es) y ${unidades} unidades vendidas.`;
}

// ----------------- 6. PRODUCTO MÁS VENDIDO -----------------

export async function analizarProductoTop(userId: string): Promise<string> {
  const { ventas } = await obtenerDatos(userId);

  if (ventas.length === 0) {
    return "Todavía no tienes ventas registradas para saber cuál es tu producto estrella.";
  }

  const unidades = unidadesPorProducto(ventas);
  const ingresos = ingresosPorProducto(ventas);

  const topUnidades = Array.from(unidades.entries()).sort((a, b) => b[1] - a[1])[0];
  const topIngresos = Array.from(ingresos.entries()).sort((a, b) => b[1] - a[1])[0];

  if (topUnidades[0] === topIngresos[0]) {
    return `Tu producto estrella es **${topUnidades[0]}** — es el más vendido tanto en unidades (${topUnidades[1]}) como en ingresos ($${topIngresos[1].toFixed(2)}), de todo tu historial.`;
  }

  return `Depende de cómo lo midas:\n\n- Por **unidades vendidas**: **${topUnidades[0]}** (${topUnidades[1]} unidades).\n- Por **ingresos generados**: **${topIngresos[0]}** ($${topIngresos[1].toFixed(2)}).`;
}

// ----------------- 7. PRODUCTOS AGOTADOS -----------------

export async function analizarAgotados(userId: string): Promise<string> {
  const { productos } = await obtenerDatos(userId);

  const agotados = productos.filter((p) => p.stock === 0);

  if (agotados.length === 0) {
    return "✅ No tienes ningún producto agotado en este momento.";
  }

  const lineas = agotados
    .slice(0, 10)
    .map((p, i) => `${i + 1}. **${p.nombre}**`)
    .join("\n");

  const extra = agotados.length > 10 ? `\n\n...y ${agotados.length - 10} más.` : "";

  return `Tienes **${agotados.length} producto(s) agotados**:\n\n${lineas}${extra}`;
}

// ----------------- 8. RESUMEN DE INVENTARIO -----------------

export async function analizarInventario(userId: string): Promise<string> {
  const { productos } = await obtenerDatos(userId);

  if (productos.length === 0) {
    return "Todavía no tienes productos registrados en tu catálogo.";
  }

  const unidadesTotales = productos.reduce((sum, p) => sum + Number(p.stock), 0);
  const valorInventario = productos.reduce(
    (sum, p) => sum + Number(p.stock) * Number(p.precio_venta),
    0
  );
  const bajos = productos.filter((p) => p.stock <= (p.stock_minimo ?? 5) && p.stock > 0).length;
  const agotados = productos.filter((p) => p.stock === 0).length;

  return `Tu catálogo tiene **${productos.length} productos**, con **${unidadesTotales} unidades** en total.\n\nValor estimado del inventario (a precio de venta): **$${valorInventario.toFixed(2)}**.\n\n${agotados} agotados, ${bajos} con stock bajo.`;
}


// ----------------- 4. RESUMEN DE VENTAS DE LA SEMANA -----------------

export async function analizarResumenSemana(userId: string): Promise<string> {
  const { ventas } = await obtenerDatos(userId);

  const hoy = new Date();
  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(hoy.getDate() - 7);
  const inicioSemanaAnterior = new Date(hoy);
  inicioSemanaAnterior.setDate(hoy.getDate() - 14);

  const semanaActual = ventasEnRango(ventas, inicioSemana, hoy);
  const semanaAnterior = ventasEnRango(ventas, inicioSemanaAnterior, inicioSemana);

  const totalActual = semanaActual.reduce((sum, v) => sum + Number(v.total), 0);
  const totalAnterior = semanaAnterior.reduce((sum, v) => sum + Number(v.total), 0);
  const numTransacciones = semanaActual.length;
  const ticketPromedio = numTransacciones > 0 ? totalActual / numTransacciones : 0;

  const ingresos = ingresosPorProducto(semanaActual);
  const top = Array.from(ingresos.entries()).sort((a, b) => b[1] - a[1])[0];

  const cambio =
    totalAnterior > 0
      ? ((totalActual - totalAnterior) / totalAnterior) * 100
      : null;

  const lineaCambio =
    cambio !== null
      ? `${cambio >= 0 ? "▲" : "▼"} ${Math.abs(cambio).toFixed(1)}% vs la semana anterior`
      : "sin datos de la semana anterior para comparar";

  const lineaTop = top
    ? `Tu producto más vendido fue **${top[0]}**, con $${top[1].toFixed(2)} en ingresos.`
    : "No hubo ventas registradas esta semana.";

  return `**Resumen de los últimos 7 días:**\n\n- Ingresos totales: $${totalActual.toFixed(2)} (${lineaCambio})\n- Ventas registradas: ${numTransacciones}\n- Ticket promedio: $${ticketPromedio.toFixed(2)}\n\n${lineaTop}`;
}

// ----------------- 9. MEJORES CLIENTES -----------------

export async function analizarMejorCliente(userId: string): Promise<string> {
  const { ventas, clientes } = await obtenerDatos(userId);

  const conCliente = ventas.filter((v) => v.cliente_id != null);

  if (conCliente.length === 0) {
    return "Todavía no tienes ventas asociadas a un cliente específico. Elige un cliente al registrar una venta para que pueda darte este análisis.";
  }

  const nombrePorId = new Map(clientes.map((c) => [c.id, c.nombre]));

  const totales = new Map<number, { total: number; compras: number }>();
  for (const v of conCliente) {
    const id = v.cliente_id as number;
    const actual = totales.get(id) ?? { total: 0, compras: 0 };
    actual.total += Number(v.total);
    actual.compras += 1;
    totales.set(id, actual);
  }

  const ranking = Array.from(totales.entries())
    .map(([id, datos]) => ({
      nombre: nombrePorId.get(id) ?? "Cliente eliminado",
      ...datos,
    }))
    .sort((a, b) => b.total - a.total);

  const lineas = ranking
    .slice(0, 5)
    .map((c, i) => `${i + 1}. **${c.nombre}** — $${c.total.toFixed(2)} en ${c.compras} compra(s).`)
    .join("\n");

  return `Tus mejores clientes por total comprado:\n\n${lineas}`;
}
