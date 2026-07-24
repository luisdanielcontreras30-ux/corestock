import { supabase } from "../../lib/supabase";
import { ajustarStockConCas } from "../../lib/stockCas";
import { obtenerNegocioId } from "../../lib/negocioActual";
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

  // Las 2 consultas son independientes — se piden en paralelo en vez de
  // una tras otra para no sumar sus tiempos de ida y vuelta.
  const [
    { data: productos, error: errorProductos },
    { data: ajustes, error: errorAjustes },
  ] = await Promise.all([
    supabase
      .from("productos")
      .select("id, nombre, stock, categoria")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("ajustes_stock")
      .select("*")
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

  // Se repite aquí la misma validación que ya hace el formulario —
  // esta acción es exportada y podría llamarse directamente sin pasar
  // por él, mismo patrón que Compras/Devoluciones/Fabricación.
  if (!Number.isFinite(cantidadAjuste) || cantidadAjuste === 0 || !Number.isInteger(cantidadAjuste)) {
    throw new Error("CANTIDAD_INVALIDA");
  }

  const negocioId = await obtenerNegocioId(user.id);

  const { data: productoActual, error: errorProductoActual } = await supabase
    .from("productos")
    .select("stock")
    .eq("id", producto.id)
    .single();

  if (errorProductoActual) {
    throw errorProductoActual;
  }

  const stockNuevo = productoActual.stock + cantidadAjuste;

  if (stockNuevo < 0) {
    throw new Error("SIN_STOCK");
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
      user_id: negocioId,
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
    .eq("stock", productoActual.stock)
    .select("id");

  if (errorStock) {
    await supabase.from("ajustes_stock").delete().eq("id", ajusteCreado.id);
    throw errorStock;
  }

  if (!actualizado || actualizado.length === 0) {
    await supabase.from("ajustes_stock").delete().eq("id", ajusteCreado.id);
    throw new Error("STOCK_CAMBIO");
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
    .single();

  if (errorAjuste) {
    throw errorAjuste;
  }

  if (ajuste.producto_id) {
    const negocioId = await obtenerNegocioId(user.id);

    // CAS con reintentos (igual que Ventas/Compras/registrarAjuste) en vez
    // de leer-y-escribir sin candado: si el producto no existe ya no hay
    // stock que revertir y se sigue adelante con el borrado igual.
    const exito = await ajustarStockConCas(ajuste.producto_id, negocioId, -ajuste.cantidad_ajuste, {
      minimoCero: true,
    });

    if (!exito) {
      throw new Error("STOCK_CAMBIO");
    }
  }

  const { error: errorEliminar } = await supabase
    .from("ajustes_stock")
    .delete()
    .eq("id", id);

  if (errorEliminar) {
    throw errorEliminar;
  }
}
