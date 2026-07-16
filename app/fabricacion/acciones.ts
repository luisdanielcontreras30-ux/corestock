import { supabase } from "../../lib/supabase";
import { ajustarStockConCas } from "../../lib/stockCas";
import { Producto, MateriaPrima, IngredienteReceta, Produccion } from "./types";

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

  const userId = user.id;

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
      .select("id, nombre, stock")
      .eq("user_id", userId)
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("materias_primas")
      .select("*")
      .eq("user_id", userId)
      .order("nombre"),
    supabase
      .from("recetas")
      .select("*")
      .eq("user_id", userId)
      .order("id"),
    supabase
      .from("producciones")
      .select("*")
      .eq("user_id", userId)
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

  const { error } = await supabase.from("materias_primas").insert({
    nombre: nombre.trim(),
    unidad: unidad.trim() || "unidad",
    stock,
    costo_unitario: costoUnitario,
    user_id: user.id,
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
    .eq("id", id)
    .eq("user_id", user.id);

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

  const { error } = await supabase.from("recetas").insert({
    producto_id: producto.id,
    producto_nombre: producto.nombre,
    materia_prima_id: materiaPrima.id,
    materia_prima_nombre: materiaPrima.nombre,
    cantidad_por_unidad: cantidadPorUnidad,
    user_id: user.id,
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
    .eq("id", id)
    .eq("user_id", user.id);

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

  if (cantidadAProducir <= 0) {
    throw new Error("La cantidad a producir debe ser mayor a 0.");
  }

  if (ingredientes.length === 0) {
    throw new Error("Este producto no tiene receta definida.");
  }

  const materiasIds = ingredientes.map((i) => i.materia_prima_id);

  const { data: materiasFrescas, error: errorMaterias } = await supabase
    .from("materias_primas")
    .select("id, stock")
    .in("id", materiasIds)
    .eq("user_id", user.id);

  if (errorMaterias) throw errorMaterias;

  const stockPorId = new Map(
    (materiasFrescas ?? []).map((m) => [m.id as number, m.stock as number])
  );

  for (const ing of ingredientes) {
    const necesario = ing.cantidad_por_unidad * cantidadAProducir;
    const disponible = stockPorId.get(ing.materia_prima_id) ?? 0;

    if (necesario > disponible) {
      throw new Error(
        `No hay suficiente "${ing.materia_prima_nombre}" — necesitas ${necesario}, tienes ${disponible}.`
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
        .eq("user_id", user.id)
        .eq("stock", stockActual)
        .select("id");

      if (error) throw error;

      if (!actualizado || actualizado.length === 0) {
        throw new Error(
          `El stock de "${ing.materia_prima_nombre}" cambió mientras se procesaba. Intenta de nuevo.`
        );
      }

      aplicados.push({ id: ing.materia_prima_id, necesario });
    }

    const { data: productoActual, error: errorProductoActual } = await supabase
      .from("productos")
      .select("stock")
      .eq("id", producto.id)
      .eq("user_id", user.id)
      .single();

    if (errorProductoActual) throw errorProductoActual;

    const nuevoStockProducto = productoActual.stock + cantidadAProducir;

    const { data: actualizadoProducto, error: errorProducto } = await supabase
      .from("productos")
      .update({ stock: nuevoStockProducto })
      .eq("id", producto.id)
      .eq("user_id", user.id)
      .eq("stock", productoActual.stock)
      .select("id");

    if (errorProducto) throw errorProducto;

    if (!actualizadoProducto || actualizadoProducto.length === 0) {
      throw new Error(
        "El stock del producto cambió mientras se procesaba la producción. Intenta de nuevo."
      );
    }

    const { error: errorLog } = await supabase.from("producciones").insert({
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      cantidad: cantidadAProducir,
      fecha: new Date().toISOString(),
      user_id: user.id,
    });

    if (errorLog) throw errorLog;
  } catch (error) {
    // Revertimos las materias primas que ya se habían descontado antes
    // de que fallara el paso siguiente. Se suma de vuelta con CAS (en
    // vez de pisar con el stock previo guardado) para no perder algún
    // otro movimiento concurrente sobre esa misma materia prima mientras
    // esta producción estaba en curso.
    for (const a of aplicados) {
      await ajustarStockConCas(a.id, user.id, a.necesario, {
        tabla: "materias_primas",
      });
    }
    throw error;
  }
}
