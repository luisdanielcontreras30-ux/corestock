import { supabase } from "../../lib/supabase";
import { Producto, AjusteStock } from "./types";

export async function cargarDatos() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      productos: [] as Producto[],
      ajustes: [] as AjusteStock[],
    };
  }

  const userId = user.id;

  // Las 2 consultas son independientes — se piden en paralelo en vez de
  // una tras otra para no sumar sus tiempos de ida y vuelta.
  const [
    { data: productos, error: errorProductos },
    { data: ajustes, error: errorAjustes },
  ] = await Promise.all([
    supabase
      .from("productos")
      .select("id, nombre, stock")
      .eq("user_id", userId)
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("ajustes_stock")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: false }),
  ]);

  if (errorProductos) throw errorProductos;
  if (errorAjustes) throw errorAjustes;

  return {
    productos: (productos ?? []) as Producto[],
    ajustes: (ajustes ?? []) as AjusteStock[],
  };
}

// cantidadAjuste: positivo agrega stock, negativo quita stock.
export async function registrarAjuste(
  producto: Producto,
  cantidadAjuste: number,
  motivo: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { data: productoActual, error: errorProductoActual } = await supabase
    .from("productos")
    .select("stock")
    .eq("id", producto.id)
    .eq("user_id", user.id)
    .single();

  if (errorProductoActual) {
    throw errorProductoActual;
  }

  const stockNuevo = productoActual.stock + cantidadAjuste;

  if (stockNuevo < 0) {
    throw new Error("No puedes quitar más stock del que hay disponible.");
  }

  const { data: ajusteCreado, error: errorAjuste } = await supabase
    .from("ajustes_stock")
    .insert({
      fecha: new Date().toISOString(),
      producto: producto.nombre,
      producto_id: producto.id,
      cantidad_ajuste: cantidadAjuste,
      stock_anterior: productoActual.stock,
      stock_nuevo: stockNuevo,
      motivo: motivo.trim() || null,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (errorAjuste) {
    throw errorAjuste;
  }

  // Update "compare-and-swap": mismo candado que Compras/Ventas contra
  // condiciones de carrera con otra venta/compra/ajuste concurrente.
  const { data: actualizado, error: errorStock } = await supabase
    .from("productos")
    .update({ stock: stockNuevo })
    .eq("id", producto.id)
    .eq("user_id", user.id)
    .eq("stock", productoActual.stock)
    .select("id");

  if (errorStock) {
    await supabase.from("ajustes_stock").delete().eq("id", ajusteCreado.id);
    throw errorStock;
  }

  if (!actualizado || actualizado.length === 0) {
    await supabase.from("ajustes_stock").delete().eq("id", ajusteCreado.id);
    throw new Error(
      "El stock de este producto cambió mientras se procesaba el ajuste. Intenta de nuevo."
    );
  }
}

export async function eliminarAjuste(id: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { data: ajuste, error: errorAjuste } = await supabase
    .from("ajustes_stock")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (errorAjuste) {
    throw errorAjuste;
  }

  if (ajuste.producto_id) {
    const { data: producto, error: errorProducto } = await supabase
      .from("productos")
      .select("stock")
      .eq("id", ajuste.producto_id)
      .eq("user_id", user.id)
      .maybeSingle();

    // Si el producto ya no existe, no hay stock que revertir — seguimos
    // adelante y borramos el ajuste igual, en vez de bloquear el borrado.
    if (!errorProducto && producto) {
      const stockRevertido = Math.max(0, producto.stock - ajuste.cantidad_ajuste);

      const { error: errorStock } = await supabase
        .from("productos")
        .update({ stock: stockRevertido })
        .eq("id", ajuste.producto_id)
        .eq("user_id", user.id);

      if (errorStock) {
        throw errorStock;
      }
    }
  }

  const { error: errorEliminar } = await supabase
    .from("ajustes_stock")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (errorEliminar) {
    throw errorEliminar;
  }
}
