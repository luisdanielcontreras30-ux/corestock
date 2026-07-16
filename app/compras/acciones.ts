import { supabase } from "../../lib/supabase";
import { ajustarStockConCas } from "../../lib/stockCas";
import { Producto, Proveedor, Compra } from "./types";

export async function cargarDatos() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      productos: [] as Producto[],
      proveedores: [] as Proveedor[],
      compras: [] as Compra[],
    };
  }

  const userId = user.id;

  // Las 3 consultas son independientes — se piden en paralelo en vez de
  // una tras otra para no sumar sus tiempos de ida y vuelta.
  const [
    { data: productos, error: errorProductos },
    { data: proveedores, error: errorProveedores },
    { data: compras, error: errorCompras },
  ] = await Promise.all([
    supabase
      .from("productos")
      .select("id, nombre, costo, stock")
      .eq("user_id", userId)
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("proveedores")
      .select("id, nombre")
      .eq("user_id", userId)
      .order("nombre"),
    supabase
      .from("compras")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: false }),
  ]);

  if (errorProductos) throw errorProductos;
  if (errorProveedores) throw errorProveedores;
  if (errorCompras) throw errorCompras;

  return {
    productos: (productos ?? []) as Producto[],
    proveedores: (proveedores ?? []) as Proveedor[],
    compras: (compras ?? []) as Compra[],
  };
}

export async function registrarCompra(
  producto: Producto,
  proveedorId: string | null,
  proveedorNombre: string,
  cantidad: number,
  costoUnitario: number,
  nota: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new Error("La cantidad debe ser mayor a 0.");
  }

  if (!Number.isFinite(costoUnitario) || costoUnitario < 0) {
    throw new Error("El costo no puede ser negativo.");
  }

  // Releemos el stock justo antes de comprar, igual que en Ventas, para
  // no partir de un valor desactualizado.
  const { data: productoActual, error: errorProductoActual } = await supabase
    .from("productos")
    .select("stock")
    .eq("id", producto.id)
    .eq("user_id", user.id)
    .single();

  if (errorProductoActual) {
    throw errorProductoActual;
  }

  const total = cantidad * costoUnitario;

  const { data: compraCreada, error: errorCompra } = await supabase
    .from("compras")
    .insert({
      fecha: new Date().toISOString(),
      producto: producto.nombre,
      producto_id: producto.id,
      proveedor_id: proveedorId,
      proveedor_nombre: proveedorNombre.trim() || null,
      cantidad,
      costo_unitario: costoUnitario,
      total,
      nota: nota.trim() || null,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (errorCompra) {
    throw errorCompra;
  }

  const nuevoStock = productoActual.stock + cantidad;

  // Update "compare-and-swap": igual que en Ventas, evita pisar el
  // resultado de otra compra/venta concurrente sobre el mismo producto.
  // De paso actualizamos el costo del producto al de esta compra (costeo
  // por última compra), para que Ganancias en el Asistente no quede
  // calculando con un costo viejo.
  const { data: actualizado, error: errorStock } = await supabase
    .from("productos")
    .update({ stock: nuevoStock, costo: costoUnitario })
    .eq("id", producto.id)
    .eq("user_id", user.id)
    .eq("stock", productoActual.stock)
    .select("id");

  if (errorStock) {
    await supabase.from("compras").delete().eq("id", compraCreada.id);
    throw errorStock;
  }

  if (!actualizado || actualizado.length === 0) {
    await supabase.from("compras").delete().eq("id", compraCreada.id);
    throw new Error(
      "El stock de este producto cambió mientras se procesaba la compra. Intenta de nuevo."
    );
  }
}

export async function eliminarCompra(id: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { data: compra, error: errorCompra } = await supabase
    .from("compras")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (errorCompra) {
    throw errorCompra;
  }

  if (compra.producto_id) {
    // Compare-and-swap, igual que al registrar: si otra venta/compra
    // concurrente sobre el mismo producto cambia el stock justo en este
    // instante, reintenta desde el valor fresco en vez de pisarlo.
    const exito = await ajustarStockConCas(
      compra.producto_id,
      user.id,
      -compra.cantidad,
      { minimoCero: true }
    );

    if (!exito) {
      throw new Error(
        "El stock de este producto cambió mientras se procesaba el borrado. Intenta de nuevo."
      );
    }
  }

  const { error: errorEliminar } = await supabase
    .from("compras")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (errorEliminar) {
    throw errorEliminar;
  }
}
