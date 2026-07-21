import { supabase } from "../../lib/supabase";
import { ajustarStockConCas } from "../../lib/stockCas";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { Producto, Ubicacion, StockUbicacion, Traspaso } from "./types";

export async function cargarDatos() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      productos: [] as Producto[],
      ubicaciones: [] as Ubicacion[],
      stockUbicaciones: [] as StockUbicacion[],
      traspasos: [] as Traspaso[],
    };
  }

  // Las 4 consultas son independientes — se piden en paralelo en vez de
  // una tras otra para no sumar sus tiempos de ida y vuelta.
  const [
    { data: productos, error: errorProductos },
    { data: ubicaciones, error: errorUbicaciones },
    { data: stockUbicaciones, error: errorStock },
    { data: traspasos, error: errorTraspasos },
  ] = await Promise.all([
    supabase
      .from("productos")
      .select("id, nombre, stock")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("ubicaciones")
      .select("id, nombre")
      .order("nombre"),
    supabase
      .from("stock_ubicaciones")
      .select("id, producto_id, ubicacion_id, stock, productos(nombre)")
      .gt("stock", 0),
    supabase
      .from("traspasos")
      .select("*")
      .order("fecha", { ascending: false }),
  ]);

  if (errorProductos) throw errorProductos;
  if (errorUbicaciones) throw errorUbicaciones;
  if (errorStock) throw errorStock;
  if (errorTraspasos) throw errorTraspasos;

  return {
    productos: (productos ?? []) as Producto[],
    ubicaciones: (ubicaciones ?? []) as Ubicacion[],
    stockUbicaciones: (stockUbicaciones ?? []).map(
      (fila: { id: number; producto_id: number; ubicacion_id: number; stock: number; productos: { nombre: string } | { nombre: string }[] | null }) => ({
        id: fila.id,
        producto_id: fila.producto_id,
        ubicacion_id: fila.ubicacion_id,
        stock: fila.stock,
        producto_nombre: Array.isArray(fila.productos)
          ? fila.productos[0]?.nombre ?? ""
          : fila.productos?.nombre ?? "",
      })
    ) as StockUbicacion[],
    traspasos: (traspasos ?? []) as Traspaso[],
  };
}

export async function crearUbicacion(nombre: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuario no autenticado");

  const negocioId = await obtenerNegocioId(user.id);

  const { error } = await supabase
    .from("ubicaciones")
    .insert({ nombre: nombre.trim(), user_id: negocioId });

  if (error) throw error;
}

export async function eliminarUbicacion(id: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuario no autenticado");

  const { data: filasConStock, error: errorConsulta } = await supabase
    .from("stock_ubicaciones")
    .select("id")
    .eq("ubicacion_id", id)
    .gt("stock", 0)
    .limit(1);

  if (errorConsulta) throw errorConsulta;

  if (filasConStock && filasConStock.length > 0) {
    throw new Error("Esta ubicación todavía tiene stock. Traspásalo antes de eliminarla.");
  }

  const { error } = await supabase
    .from("ubicaciones")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Suma (o resta, con delta negativo) stock en una ubicación secundaria,
// creando la fila si todavía no existe. Usa el mismo candado
// compare-and-swap que el resto de la app contra condiciones de carrera.
async function ajustarStockUbicacion(
  negocioId: string,
  productoId: number,
  ubicacionId: number,
  delta: number
) {
  const { data: fila, error: errorFila } = await supabase
    .from("stock_ubicaciones")
    .select("id, stock")
    .eq("producto_id", productoId)
    .eq("ubicacion_id", ubicacionId)
    .eq("user_id", negocioId)
    .maybeSingle();

  if (errorFila) throw errorFila;

  if (!fila) {
    if (delta < 0) {
      throw new Error("No hay suficiente stock en esa ubicación.");
    }

    const { error } = await supabase
      .from("stock_ubicaciones")
      .insert({ producto_id: productoId, ubicacion_id: ubicacionId, stock: delta, user_id: negocioId });

    if (error) throw error;
    return;
  }

  const nuevoStock = fila.stock + delta;

  if (nuevoStock < 0) {
    throw new Error("No hay suficiente stock en esa ubicación.");
  }

  const { data: actualizado, error } = await supabase
    .from("stock_ubicaciones")
    .update({ stock: nuevoStock })
    .eq("id", fila.id)
    .eq("user_id", negocioId)
    .eq("stock", fila.stock)
    .select("id");

  if (error) throw error;

  if (!actualizado || actualizado.length === 0) {
    throw new Error("El stock de esa ubicación cambió mientras se procesaba. Intenta de nuevo.");
  }
}

// origenId/destinoId en null significan "Tienda" (productos.stock, el
// stock principal que usan Ventas, Compras, etc.).
export async function realizarTraspaso(
  producto: Producto,
  cantidad: number,
  origenId: number | null,
  destinoId: number | null,
  origenNombre: string | null,
  destinoNombre: string | null
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuario no autenticado");

  const negocioId = await obtenerNegocioId(user.id);

  if (cantidad <= 0) {
    throw new Error("La cantidad debe ser mayor a 0.");
  }

  if (origenId === destinoId) {
    throw new Error("El origen y el destino no pueden ser el mismo.");
  }

  // Paso 1: descontar del origen.
  if (origenId === null) {
    const { data: productoActual, error } = await supabase
      .from("productos")
      .select("stock")
      .eq("id", producto.id)
      .single();

    if (error) throw error;

    if (productoActual.stock < cantidad) {
      throw new Error("No hay suficiente stock en la Tienda.");
    }

    const { data: actualizado, error: errorUpdate } = await supabase
      .from("productos")
      .update({ stock: productoActual.stock - cantidad })
      .eq("id", producto.id)
      .eq("stock", productoActual.stock)
      .select("id");

    if (errorUpdate) throw errorUpdate;

    if (!actualizado || actualizado.length === 0) {
      throw new Error("El stock de este producto cambió mientras se procesaba. Intenta de nuevo.");
    }
  } else {
    await ajustarStockUbicacion(negocioId, producto.id, origenId, -cantidad);
  }

  try {
    // Paso 2: sumar al destino.
    if (destinoId === null) {
      const { data: productoActual, error } = await supabase
        .from("productos")
        .select("stock")
        .eq("id", producto.id)
        .single();

      if (error) throw error;

      const { data: actualizadoDestino, error: errorUpdate } = await supabase
        .from("productos")
        .update({ stock: productoActual.stock + cantidad })
        .eq("id", producto.id)
        .eq("stock", productoActual.stock)
        .select("id");

      if (errorUpdate) throw errorUpdate;

      if (!actualizadoDestino || actualizadoDestino.length === 0) {
        throw new Error("El stock de este producto cambió mientras se procesaba. Intenta de nuevo.");
      }
    } else {
      await ajustarStockUbicacion(negocioId, producto.id, destinoId, cantidad);
    }

    // Paso 3: bitácora.
    const { error: errorTraspaso } = await supabase.from("traspasos").insert({
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      ubicacion_origen_id: origenId,
      ubicacion_origen_nombre: origenNombre,
      ubicacion_destino_id: destinoId,
      ubicacion_destino_nombre: destinoNombre,
      cantidad,
      fecha: new Date().toISOString(),
      user_id: negocioId,
    });

    if (errorTraspaso) throw errorTraspaso;
  } catch (error) {
    // Revertir el paso 1 (mejor esfuerzo) si algo falló después. Con CAS
    // (sumar de vuelta) en vez de pisar con el stock previo guardado, para
    // no perder algún otro movimiento concurrente sobre ese mismo producto
    // mientras este traspaso estaba en curso.
    if (origenId === null) {
      await ajustarStockConCas(producto.id, negocioId, cantidad).catch((errorRevertir) => {
        console.error(
          `No se pudo revertir el stock de producto_id=${producto.id} tras un fallo en el traspaso. Revisar manualmente.`,
          errorRevertir
        );
      });
    } else {
      await ajustarStockUbicacion(negocioId, producto.id, origenId, cantidad).catch((errorRevertir) => {
        console.error(
          `No se pudo revertir el stock de ubicación (producto_id=${producto.id}, ubicacion_id=${origenId}) tras un fallo en el traspaso. Revisar manualmente.`,
          errorRevertir
        );
      });
    }

    throw error;
  }
}
