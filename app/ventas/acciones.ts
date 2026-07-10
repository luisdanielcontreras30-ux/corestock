import { supabase } from "../../lib/supabase";
import { Producto, Cliente, Venta } from "./types";

export async function cargarDatos() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      productos: [] as Producto[],
      clientes: [] as Cliente[],
      ventas: [] as Venta[],
    };
  }

  const userId = user.id;

  const { data: productos, error: errorProductos } =
    await supabase
      .from("productos")
      .select("*")
      .eq("user_id", userId)
      .eq("activo", true)
      .order("nombre");

  if (errorProductos) {
    throw errorProductos;
  }

  const { data: clientes, error: errorClientes } =
    await supabase
      .from("clientes")
      .select("*")
      .eq("user_id", userId)
      .order("nombre");

  if (errorClientes) {
    throw errorClientes;
  }

  const { data: ventas, error: errorVentas } =
    await supabase
      .from("ventas")
      .select(`
        *,
        clientes(
          nombre
        )
      `)
      .eq("user_id", userId)
      .order("id", {
        ascending: false,
      });

  if (errorVentas) {
    throw errorVentas;
  }

  return {
    productos: productos ?? [],
    clientes: clientes ?? [],
    ventas: (ventas ?? []) as Venta[],
  };
}
export async function registrarVenta(
  producto: Producto,
  cliente: Cliente | null,
  cantidad: number,
  nombreCliente: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  let clienteId = cliente?.id ?? null;

  if (!clienteId && nombreCliente.trim() !== "") {
    const { data: clienteExistente } =
      await supabase
        .from("clientes")
        .select("*")
        .eq("user_id", user.id)
        .ilike("nombre", nombreCliente.trim())
        .maybeSingle();

    if (clienteExistente) {
      clienteId = clienteExistente.id;
    } else {
      const {
        data: nuevoCliente,
        error: errorCliente,
      } = await supabase
        .from("clientes")
        .insert({
          nombre: nombreCliente.trim(),
          user_id: user.id,
        })
        .select()
        .single();

      if (errorCliente) {
        throw errorCliente;
      }

      clienteId = nuevoCliente.id;
    }
  }

  const total =
    producto.precio_venta * cantidad;

  const { error: errorVenta } =
    await supabase
      .from("ventas")
      .insert({
        fecha: new Date().toISOString(),
        producto: producto.nombre,
        producto_id: producto.id,
        cliente_id: clienteId,
        cantidad,
        precio: producto.precio_venta,
        total,
        user_id: user.id,
      });

  if (errorVenta) {
    throw errorVenta;
  }

  const nuevoStock =
    producto.stock - cantidad;

  const { error: errorStock } =
    await supabase
      .from("productos")
      .update({
        stock: nuevoStock,
      })
      .eq("id", producto.id);

  if (errorStock) {
    throw errorStock;
  }
}
export async function eliminarVenta(
  id: number
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error(
      "Usuario no autenticado"
    );
  }

  const {
    data: venta,
    error: errorVenta,
  } = await supabase
    .from("ventas")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (errorVenta) {
    throw errorVenta;
  }

  if (venta.producto_id) {
    const {
      data: producto,
      error: errorProducto,
    } = await supabase
      .from("productos")
      .select("stock")
      .eq("id", venta.producto_id)
      .maybeSingle();

    // Si el producto ya no existe (fue borrado por separado), no hay
    // stock que restaurar — seguimos adelante y borramos la venta igual,
    // en vez de bloquear todo el borrado por esto.
    if (!errorProducto && producto) {
      const { error: errorStock } =
        await supabase
          .from("productos")
          .update({
            stock:
              producto.stock +
              venta.cantidad,
          })
          .eq("id", venta.producto_id);

      if (errorStock) {
        throw errorStock;
      }
    }
  }

  const {
    error: errorEliminar,
  } = await supabase
    .from("ventas")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (errorEliminar) {
    throw errorEliminar;
  }
}