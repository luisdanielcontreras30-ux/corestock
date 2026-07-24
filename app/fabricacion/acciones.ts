import { supabase } from "../../lib/supabase";
import { ajustarStockConCas } from "../../lib/stockCas";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { Producto, MateriaPrima, IngredienteReceta, Produccion } from "./types";

// A diferencia de los demás sentinels de este archivo (mensaje fijo,
// traducido por clave en page.tsx), este trae los números de la
// materia prima faltante — page.tsx arma el mensaje combinando sus
// claves i18n con estos campos, mismo patrón que el resto de la app ya
// usa para pegar t("clave") con un valor dinámico.
export class ErrorStockInsuficienteMateria extends Error {
  constructor(
    public materiaPrimaNombre: string,
    public necesario: number,
    public disponible: number
  ) {
    super("SIN_STOCK_MATERIA");
    this.name = "ErrorStockInsuficienteMateria";
  }
}

export async function cargarDatos() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      productos: [] as Producto[],
      materiasPrimas: [] as MateriaPrima[],
      recetas: [] as IngredienteReceta[],
      producciones: [] as Produccion[],
    };
  }

  // Las 4 consultas son independientes — se piden en paralelo en vez de
  // una tras otra para no sumar sus tiempos de ida y vuelta.
  const [
    { data: productos, error: errorProductos },
    { data: materiasPrimas, error: errorMaterias },
    { data: recetas, error: errorRecetas },
    { data: producciones, error: errorProducciones },
  ] = await Promise.all([
    supabase
      .from("productos")
      .select("id, nombre, stock, precio_venta")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("materias_primas")
      .select("*")
      .order("nombre"),
    supabase
      .from("recetas")
      .select("*")
      .order("id"),
    supabase
      .from("producciones")
      .select("*")
      .order("id", { ascending: false }),
  ]);

  if (errorProductos) throw errorProductos;
  if (errorMaterias) throw errorMaterias;
  if (errorRecetas) throw errorRecetas;
  if (errorProducciones) throw errorProducciones;

  return {
    productos: (productos ?? []) as Producto[],
    materiasPrimas: (materiasPrimas ?? []) as MateriaPrima[],
    recetas: (recetas ?? []) as IngredienteReceta[],
    producciones: (producciones ?? []) as Produccion[],
  };
}

export async function crearMateriaPrima(
  nombre: string,
  unidad: string,
  stock: number,
  costoUnitario: number
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuario no autenticado");

  // Se repite aquí la misma validación que ya hace el formulario —
  // esta acción es exportada y podría llamarse directamente sin pasar
  // por él, mismo patrón que Compras/Devoluciones/Promociones.
  if (!Number.isFinite(stock) || stock < 0 || !Number.isFinite(costoUnitario) || costoUnitario < 0) {
    throw new Error("DATOS_INVALIDOS");
  }

  const negocioId = await obtenerNegocioId(user.id);

  const { error } = await supabase.from("materias_primas").insert({
    nombre: nombre.trim(),
    unidad: unidad.trim() || "unidad",
    stock,
    costo_unitario: costoUnitario,
    user_id: negocioId,
  });

  if (error) throw error;
}

export async function eliminarMateriaPrima(id: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuario no autenticado");

  const { error } = await supabase
    .from("materias_primas")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function agregarIngrediente(
  producto: Producto,
  materiaPrima: MateriaPrima,
  cantidadPorUnidad: number
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuario no autenticado");

  // Se repite aquí la misma validación que ya hace el formulario —
  // esta acción es exportada y podría llamarse directamente sin pasar
  // por él. Además de ser una validación de negocio, es una guarda de
  // integridad real: producir() (más abajo) resta
  // cantidad_por_unidad * cantidadAProducir del stock de la materia
  // prima — con un valor negativo, esa resta AUMENTARÍA el stock en
  // vez de descontarlo, e incluso pasaría de largo el chequeo de
  // "no hay suficiente stock" (un número negativo siempre es menor
  // que el disponible).
  if (!Number.isFinite(cantidadPorUnidad) || cantidadPorUnidad <= 0) {
    throw new Error("CANTIDAD_INVALIDA");
  }

  const negocioId = await obtenerNegocioId(user.id);

  const { error } = await supabase.from("recetas").insert({
    producto_id: producto.id,
    producto_nombre: producto.nombre,
    materia_prima_id: materiaPrima.id,
    materia_prima_nombre: materiaPrima.nombre,
    cantidad_por_unidad: cantidadPorUnidad,
    user_id: negocioId,
  });

  if (error) throw error;
}

export async function eliminarIngrediente(id: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuario no autenticado");

  const { error } = await supabase
    .from("recetas")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Produce "cantidadAProducir" unidades del producto: descuenta cada
// materia prima de la receta (compare-and-swap, una por una) y aumenta
// el stock del producto terminado. Si algo falla a medio camino, revierte
// las materias primas que ya se habían descontado antes de fallar.
export async function producir(
  producto: Producto,
  cantidadAProducir: number,
  ingredientes: IngredienteReceta[]
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuario no autenticado");

  const negocioId = await obtenerNegocioId(user.id);

  if (!Number.isFinite(cantidadAProducir) || cantidadAProducir <= 0) {
    throw new Error("CANTIDAD_INVALIDA");
  }

  if (ingredientes.length === 0) {
    throw new Error("SIN_RECETA");
  }

  const materiasIds = ingredientes.map((i) => i.materia_prima_id);

  const { data: materiasFrescas, error: errorMaterias } = await supabase
    .from("materias_primas")
    .select("id, stock")
    .in("id", materiasIds);

  if (errorMaterias) throw errorMaterias;

  const stockPorId = new Map(
    (materiasFrescas ?? []).map((m) => [m.id as number, m.stock as number])
  );

  for (const ing of ingredientes) {
    const necesario = ing.cantidad_por_unidad * cantidadAProducir;
    const disponible = stockPorId.get(ing.materia_prima_id) ?? 0;

    if (necesario > disponible) {
      // Redondeado a 2 decimales: sumar/multiplicar cantidades con
      // decimales en JS puede dejar residuos de punto flotante (ej.
      // 0.30000000000000004) que se verían mal en este mensaje.
      throw new ErrorStockInsuficienteMateria(
        ing.materia_prima_nombre,
        Math.round(necesario * 100) / 100,
        Math.round(disponible * 100) / 100
      );
    }
  }

  const aplicados: { id: number; necesario: number }[] = [];

  try {
    for (const ing of ingredientes) {
      const necesario = ing.cantidad_por_unidad * cantidadAProducir;
      const stockActual = stockPorId.get(ing.materia_prima_id)!;
      const nuevoStock = stockActual - necesario;

      const { data: actualizado, error } = await supabase
        .from("materias_primas")
        .update({ stock: nuevoStock })
        .eq("id", ing.materia_prima_id)
        .eq("stock", stockActual)
        .select("id");

      if (error) throw error;

      if (!actualizado || actualizado.length === 0) {
        throw new Error("STOCK_CAMBIO");
      }

      aplicados.push({ id: ing.materia_prima_id, necesario });
    }

    const { data: productoActual, error: errorProductoActual } = await supabase
      .from("productos")
      .select("stock")
      .eq("id", producto.id)
      .single();

    if (errorProductoActual) throw errorProductoActual;

    const nuevoStockProducto = productoActual.stock + cantidadAProducir;

    const { data: actualizadoProducto, error: errorProducto } = await supabase
      .from("productos")
      .update({ stock: nuevoStockProducto })
      .eq("id", producto.id)
      .eq("stock", productoActual.stock)
      .select("id");

    if (errorProducto) throw errorProducto;

    if (!actualizadoProducto || actualizadoProducto.length === 0) {
      throw new Error("STOCK_CAMBIO");
    }

    const { error: errorLog } = await supabase.from("producciones").insert({
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      cantidad: cantidadAProducir,
      fecha: new Date().toISOString(),
      user_id: negocioId,
    });

    if (errorLog) throw errorLog;
  } catch (error) {
    // Revertimos las materias primas que ya se habían descontado antes
    // de que fallara el paso siguiente. Se suma de vuelta con CAS (en
    // vez de pisar con el stock previo guardado) para no perder algún
    // otro movimiento concurrente sobre esa misma materia prima mientras
    // esta producción estaba en curso. Cada reversión va en su propio
    // try/catch: si una de ellas falla (red, condición de carrera), no
    // debe abortar el resto del ciclo ni reemplazar el error original
    // que se relanza al final.
    for (const a of aplicados) {
      try {
        await ajustarStockConCas(a.id, negocioId, a.necesario, {
          tabla: "materias_primas",
        });
      } catch (errorRevertir) {
        console.error(
          `No se pudo revertir el stock de materia_prima_id=${a.id} tras un fallo en producir(). Revisar manualmente.`,
          errorRevertir
        );
      }
    }
    throw error;
  }
}
