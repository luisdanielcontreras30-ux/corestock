import { supabase } from "../../lib/supabase";
import { traducir, Idioma } from "../../lib/i18n";

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
  const [
    { data: productos, error: errorProductos },
    { data: ventas, error: errorVentas },
    { data: clientes, error: errorClientes },
  ] = await Promise.all([
    supabase.from("productos").select("*").eq("user_id", userId),
    supabase.from("ventas").select("*").eq("user_id", userId),
    supabase.from("clientes").select("id, nombre").eq("user_id", userId),
  ]);

  // Sin este chequeo, una consulta fallida (RLS, red, sesión vencida)
  // se veía igual que "no tienes productos/ventas/clientes" — el
  // Asistente respondía con total confianza algo como "no tienes
  // productos agotados" cuando en realidad la consulta nunca corrió.
  if (errorProductos) throw errorProductos;
  if (errorVentas) throw errorVentas;
  if (errorClientes) throw errorClientes;

  return {
    productos: (productos ?? []) as ProductoRaw[],
    ventas: (ventas ?? []) as VentaRaw[],
    clientes: (clientes ?? []) as ClienteRaw[],
  };
}

// Traduce una clave y sustituye placeholders {nombre} por sus valores,
// para poder armar las respuestas del Asistente en el idioma activo.
function f(clave: string, idioma: Idioma, valores?: Record<string, string | number>): string {
  let texto = traducir(clave, idioma);
  if (valores) {
    for (const [k, v] of Object.entries(valores)) {
      texto = texto.split(`{${k}}`).join(String(v));
    }
  }
  return texto;
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

export async function analizarQueComprar(userId: string, idioma: Idioma): Promise<string> {
  const { productos, ventas } = await obtenerDatos(userId);

  const hoy = new Date();
  const hace30 = new Date(hoy);
  hace30.setDate(hoy.getDate() - 30);

  const ventasRecientes = ventasEnRango(ventas, hace30, hoy);
  const velocidad = unidadesPorProducto(ventasRecientes);

  const bajos = productos.filter((p) => p.stock <= (p.stock_minimo ?? 5));

  if (bajos.length === 0) {
    return f("asistente.qc_ninguno", idioma);
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
          ? f("asistente.qc_con_ventas", idioma, { n: p.vendidos30dias })
          : f("asistente.qc_sin_ventas", idioma);
      return f("asistente.qc_linea", idioma, { i: i + 1, nombre: p.nombre, stock: p.stock, urgencia });
    })
    .join("\n");

  const prioritarios = conVelocidad.filter((p) => p.vendidos30dias > 0);

  const conclusion = prioritarios.length > 0
    ? `\n\n${f("asistente.qc_prioriza", idioma, { nombre: prioritarios[0].nombre })}`
    : `\n\n${f("asistente.qc_sin_venta_30d", idioma)}`;

  return `${f("asistente.qc_header", idioma, { n: bajos.length })}\n\n${lineas}${conclusion}`;
}

// ----------------- 2. ¿QUÉ PRODUCTOS DEJAN MÁS GANANCIAS? -----------------

export async function analizarGanancias(userId: string, idioma: Idioma): Promise<string> {
  const { productos, ventas } = await obtenerDatos(userId);

  const hoy = new Date();
  const hace30 = new Date(hoy);
  hace30.setDate(hoy.getDate() - 30);

  const ventasRecientes = ventasEnRango(ventas, hace30, hoy);
  const unidades = unidadesPorProducto(ventasRecientes);

  const calculados = productos
    .map((p) => {
      const vendidos = unidades.get(p.nombre) ?? 0;
      const margenUnitario = Number(p.precio_venta) - Number(p.costo ?? 0);
      const gananciaTotal = margenUnitario * vendidos;
      return { nombre: p.nombre, vendidos, margenUnitario, gananciaTotal, tieneCosto: Number(p.costo) > 0 };
    })
    .filter((p) => p.vendidos > 0)
    .sort((a, b) => b.gananciaTotal - a.gananciaTotal);

  if (calculados.length === 0) {
    return f("asistente.gan_sin_ventas", idioma);
  }

  const mostrados = calculados.slice(0, 6);

  const lineas = mostrados
    .map((p, i) =>
      f("asistente.gan_linea", idioma, {
        i: i + 1,
        nombre: p.nombre,
        total: p.gananciaTotal.toFixed(2),
        vendidos: p.vendidos,
        margen: p.margenUnitario.toFixed(2),
      })
    )
    .join("\n");

  // El aviso se basa solo en los productos que efectivamente se
  // muestran en el ranking: si esos no tienen costo registrado, su
  // "ganancia" reportada es en realidad su ingreso completo (aunque
  // otros productos del inventario sí tengan costo capturado).
  const tieneCostosEnMostrados = mostrados.some((p) => p.tieneCosto);
  const aviso = !tieneCostosEnMostrados ? `\n\n${f("asistente.gan_aviso_sin_costos", idioma)}` : "";

  return `${f("asistente.gan_header", idioma)}\n\n${lineas}${aviso}`;
}

// ----------------- 3. ¿POR QUÉ BAJARON MIS VENTAS? -----------------

export async function analizarBajaVentas(userId: string, idioma: Idioma): Promise<string> {
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
    return f("asistente.baja_insuficiente", idioma);
  }

  const cambio = ((totalActual - totalAnterior) / totalAnterior) * 100;

  if (cambio >= 0) {
    return f("asistente.baja_subieron", idioma, {
      pct: cambio.toFixed(1),
      actual: totalActual.toFixed(2),
      anterior: totalAnterior.toFixed(2),
    });
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
      ? `\n\n${f("asistente.baja_productos_header", idioma)}\n${caidas
          .map((p, i) => f("asistente.baja_producto_linea", idioma, { i: i + 1, nombre: p.nombre, monto: p.caida.toFixed(2) }))
          .join("\n")}`
      : "";

  return `${f("asistente.baja_bajaron", idioma, {
    pct: Math.abs(cambio).toFixed(1),
    actual: totalActual.toFixed(2),
    anterior: totalAnterior.toFixed(2),
  })}${detalleProductos}`;
}

// ----------------- 5. VENTAS DE HOY -----------------

export async function analizarVentasHoy(userId: string, idioma: Idioma): Promise<string> {
  const { ventas } = await obtenerDatos(userId);

  const hoy = new Date();
  const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const finDia = new Date(inicioDia);
  finDia.setDate(finDia.getDate() + 1);

  const ventasHoy = ventasEnRango(ventas, inicioDia, finDia);
  const total = ventasHoy.reduce((sum, v) => sum + Number(v.total), 0);

  if (ventasHoy.length === 0) {
    return f("asistente.hoy_ninguna", idioma);
  }

  const unidades = ventasHoy.reduce((sum, v) => sum + Number(v.cantidad), 0);

  return f("asistente.hoy_resumen", idioma, {
    total: total.toFixed(2),
    n: ventasHoy.length,
    unidades,
  });
}

// ----------------- 6. PRODUCTO MÁS VENDIDO -----------------

export async function analizarProductoTop(userId: string, idioma: Idioma): Promise<string> {
  const { ventas } = await obtenerDatos(userId);

  if (ventas.length === 0) {
    return f("asistente.top_ninguna", idioma);
  }

  const unidades = unidadesPorProducto(ventas);
  const ingresos = ingresosPorProducto(ventas);

  const topUnidades = Array.from(unidades.entries()).sort((a, b) => b[1] - a[1])[0];
  const topIngresos = Array.from(ingresos.entries()).sort((a, b) => b[1] - a[1])[0];

  if (topUnidades[0] === topIngresos[0]) {
    return f("asistente.top_mismo", idioma, {
      nombre: topUnidades[0],
      unidades: topUnidades[1],
      ingresos: topIngresos[1].toFixed(2),
    });
  }

  return f("asistente.top_distinto", idioma, {
    nombreU: topUnidades[0],
    unidadesU: topUnidades[1],
    nombreI: topIngresos[0],
    ingresosI: topIngresos[1].toFixed(2),
  });
}

// ----------------- 7. PRODUCTOS AGOTADOS -----------------

export async function analizarAgotados(userId: string, idioma: Idioma): Promise<string> {
  const { productos } = await obtenerDatos(userId);

  const agotados = productos.filter((p) => p.stock === 0);

  if (agotados.length === 0) {
    return f("asistente.agotados_ninguno", idioma);
  }

  const lineas = agotados
    .slice(0, 10)
    .map((p, i) => f("asistente.agotados_linea", idioma, { i: i + 1, nombre: p.nombre }))
    .join("\n");

  const extra = agotados.length > 10 ? `\n\n${f("asistente.agotados_extra", idioma, { n: agotados.length - 10 })}` : "";

  return `${f("asistente.agotados_header", idioma, { n: agotados.length })}\n\n${lineas}${extra}`;
}

// ----------------- 8. RESUMEN DE INVENTARIO -----------------

export async function analizarInventario(userId: string, idioma: Idioma): Promise<string> {
  const { productos } = await obtenerDatos(userId);

  if (productos.length === 0) {
    return f("asistente.inv_vacio", idioma);
  }

  const unidadesTotales = productos.reduce((sum, p) => sum + Number(p.stock), 0);
  const valorInventario = productos.reduce(
    (sum, p) => sum + Number(p.stock) * Number(p.precio_venta),
    0
  );
  const bajos = productos.filter((p) => p.stock <= (p.stock_minimo ?? 5) && p.stock > 0).length;
  const agotados = productos.filter((p) => p.stock === 0).length;

  const resumen = f("asistente.inv_resumen", idioma, { n: productos.length, unidades: unidadesTotales });
  const valor = f("asistente.inv_valor", idioma, { valor: valorInventario.toFixed(2) });
  const estado = f("asistente.inv_estado", idioma, { agotados, bajos });

  return `${resumen}\n\n${valor}\n\n${estado}`;
}

// ----------------- 4. RESUMEN DE VENTAS DE LA SEMANA -----------------

export async function analizarResumenSemana(userId: string, idioma: Idioma): Promise<string> {
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
      ? `${cambio >= 0 ? "▲" : "▼"} ${Math.abs(cambio).toFixed(1)}% ${f("asistente.resumen_vs_semana_anterior", idioma)}`
      : f("asistente.resumen_sin_datos_anteriores", idioma);

  const lineaTop = top
    ? f("asistente.resumen_top", idioma, { nombre: top[0], monto: top[1].toFixed(2) })
    : f("asistente.resumen_sin_ventas", idioma);

  const titulo = f("asistente.resumen_titulo", idioma);
  const lineaIngresos = f("asistente.resumen_ingresos", idioma, { total: totalActual.toFixed(2), cambio: lineaCambio });
  const lineaVentas = f("asistente.resumen_ventas", idioma, { n: numTransacciones });
  const lineaTicket = f("asistente.resumen_ticket", idioma, { monto: ticketPromedio.toFixed(2) });

  return `${titulo}\n\n${lineaIngresos}\n${lineaVentas}\n${lineaTicket}\n\n${lineaTop}`;
}

// ----------------- 9. MEJORES CLIENTES -----------------

export async function analizarMejorCliente(userId: string, idioma: Idioma): Promise<string> {
  const { ventas, clientes } = await obtenerDatos(userId);

  const conCliente = ventas.filter((v) => v.cliente_id != null);

  if (conCliente.length === 0) {
    return f("asistente.clientes_ninguno", idioma);
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
      nombre: nombrePorId.get(id) ?? f("asistente.clientes_eliminado", idioma),
      ...datos,
    }))
    .sort((a, b) => b.total - a.total);

  const lineas = ranking
    .slice(0, 5)
    .map((c, i) => f("asistente.clientes_linea", idioma, { i: i + 1, nombre: c.nombre, total: c.total.toFixed(2), compras: c.compras }))
    .join("\n");

  return `${f("asistente.clientes_header", idioma)}\n\n${lineas}`;
}
