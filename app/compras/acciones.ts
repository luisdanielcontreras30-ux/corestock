import { supabase } from "../../lib/supabase";
import { ajustarStockConCas } from "../../lib/stockCas";
import { obtenerNegocioId } from "../../lib/negocioActual";
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
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("proveedores")
      .select("id, nombre")
      .order("nombre"),
    supabase
      .from("compras")
      .select("*")
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

  const negocioId = await obtenerNegocioId(user.id);

  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new Error("CANTIDAD_INVALIDA");
  }

  // A diferencia del precio de venta (donde 0 es válido: una promoción de
  // 100% de descuento), un costo de compra en 0 no tiene un caso de uso
  // real aquí y sí tiene un efecto colateral dañino: la actualización de
  // abajo sobrescribe productos.costo con este valor sin condición, así
  // que un costo en 0 (typo o campo vacío) dejaría el costeo del producto
  // en $0 hasta la siguiente compra real, arruinando el cálculo de
  // Ganancias en el Asistente en silencio.
  if (!Number.isFinite(costoUnitario) || costoUnitario <= 0) {
    throw new Error("COSTO_INVALIDO");
  }

  // Releemos el stock justo antes de comprar, igual que en Ventas, para
  // no partir de un valor desactualizado.
  const { data: productoActual, error: errorProductoActual } = await supabase
    .from("productos")
    .select("stock")
    .eq("id", producto.id)
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
      user_id: negocioId,
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
    .eq("stock", productoActual.stock)
    .select("id");

  if (errorStock) {
    await supabase.from("compras").delete().eq("id", compraCreada.id);
    throw errorStock;
  }

  if (!actualizado || actualizado.length === 0) {
    await supabase.from("compras").delete().eq("id", compraCreada.id);
    throw new Error("STOCK_CAMBIO");
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
    .single();

  if (errorCompra) {
    throw errorCompra;
  }

  if (compra.producto_id) {
    const negocioId = await obtenerNegocioId(user.id);

    // Compare-and-swap, igual que al registrar: si otra venta/compra
    // concurrente sobre el mismo producto cambia el stock justo en este
    // instante, reintenta desde el valor fresco en vez de pisarlo.
    const exito = await ajustarStockConCas(
      compra.producto_id,
      negocioId,
      -compra.cantidad,
      { minimoCero: true }
    );

    if (!exito) {
      throw new Error("STOCK_CAMBIO");
    }
  }

  const { error: errorEliminar } = await supabase
    .from("compras")
    .delete()
    .eq("id", id);

  if (errorEliminar) {
    throw errorEliminar;
  }
}
