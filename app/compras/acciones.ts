import { supabase } from "../../lib/supabase";
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

  const { data: productos, error: errorProductos } = await supabase
    .from("productos")
    .select("id, nombre, costo, stock")
    .eq("user_id", userId)
    .eq("activo", true)
    .order("nombre");

  if (errorProductos) {
    throw errorProductos;
  }

  const { data: proveedores, error: errorProveedores } = await supabase
    .from("proveedores")
    .select("id, nombre")
    .eq("user_id", userId)
    .order("nombre");

  if (errorProveedores) {
    throw errorProveedores;
  }

  const { data: compras, error: errorCompras } = await supabase
    .from("compras")
    .select("*")
    .eq("user_id", userId)
    .order("id", { ascending: false });

  if (errorCompras) {
    throw errorCompras;
  }

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
  const { data: actualizado, error: errorStock } = await supabase
    .from("productos")
    .update({ stock: nuevoStock })
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
    const { data: producto, error: errorProducto } = await supabase
      .from("productos")
      .select("stock")
      .eq("id", compra.producto_id)
      .eq("user_id", user.id)
      .maybeSingle();

    // Si el producto ya no existe, no hay stock que revertir — seguimos
    // adelante y borramos la compra igual, en vez de bloquear el borrado.
    if (!errorProducto && producto) {
      const nuevoStock = Math.max(0, producto.stock - compra.cantidad);

      const { error: errorStock } = await supabase
        .from("productos")
        .update({ stock: nuevoStock })
        .eq("id", compra.producto_id)
        .eq("user_id", user.id);

      if (errorStock) {
        throw errorStock;
      }
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
