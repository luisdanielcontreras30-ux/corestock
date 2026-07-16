import { supabase } from "../../lib/supabase";
import { ajustarStockConCas } from "../../lib/stockCas";
import { Producto, Cliente, Venta, Promocion, MetodoPago } from "./types";

export async function cargarDatos() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      productos: [] as Producto[],
      clientes: [] as Cliente[],
      ventas: [] as Venta[],
      promociones: [] as Promocion[],
    };
  }

  const userId = user.id;

  // Las 4 consultas son independientes entre sí — se piden en paralelo
  // en vez de una tras otra para no sumar sus tiempos de ida y vuelta.
  const [
    { data: productos, error: errorProductos },
    { data: clientes, error: errorClientes },
    { data: ventas, error: errorVentas },
    { data: promociones, error: errorPromociones },
  ] = await Promise.all([
    supabase
      .from("productos")
      .select("*")
      .eq("user_id", userId)
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("clientes")
      .select("*")
      .eq("user_id", userId)
      .order("nombre"),
    supabase
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
      }),
    // Solo promociones activas — la vigencia por fecha se evalúa al
    // momento de vender (lib/promociones.ts).
    supabase
      .from("promociones")
      .select("id, nombre, producto_id, tipo, valor, fecha_inicio, fecha_fin")
      .eq("user_id", userId)
      .eq("activa", true),
  ]);

  if (errorProductos) throw errorProductos;
  if (errorClientes) throw errorClientes;
  if (errorVentas) throw errorVentas;
  if (errorPromociones) throw errorPromociones;

  return {
    productos: productos ?? [],
    promociones: (promociones ?? []) as Promocion[],
    clientes: clientes ?? [],
    ventas: (ventas ?? []) as Venta[],
  };
}
export async function registrarVenta(
  producto: Producto,
  cliente: Cliente | null,
  cantidad: number,
  nombreCliente: string,
  precioUnitario: number = producto.precio_venta,
  metodoPago: MetodoPago = "efectivo"
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

  // Releemos el stock justo antes de vender: evita usar un valor ya
  // desactualizado que traiga la UI si pasó tiempo desde que se cargó.
  const { data: productoActual, error: errorProductoActual } =
    await supabase
      .from("productos")
      .select("stock")
      .eq("id", producto.id)
      .eq("user_id", user.id)
      .single();

  if (errorProductoActual) {
    throw errorProductoActual;
  }

  if (productoActual.stock < cantidad) {
    throw new Error("No hay suficiente stock para esta venta.");
  }

  if (!Number.isFinite(precioUnitario) || precioUnitario <= 0) {
    throw new Error("El precio de venta debe ser mayor a 0.");
  }

  const total =
    precioUnitario * cantidad;

  const { data: ventaCreada, error: errorVenta } =
    await supabase
      .from("ventas")
      .insert({
        fecha: new Date().toISOString(),
        producto: producto.nombre,
        producto_id: producto.id,
        cliente_id: clienteId,
        cantidad,
        precio: precioUnitario,
        total,
        metodo_pago: metodoPago,
        user_id: user.id,
      })
      .select("id")
      .single();

  if (errorVenta) {
    throw errorVenta;
  }

  const nuevoStock =
    productoActual.stock - cantidad;

  // Update "compare-and-swap": solo aplica si el stock sigue siendo el
  // que acabamos de leer. Si otra venta concurrente ya lo cambió, esto
  // afecta 0 filas y detectamos la condición de carrera en vez de
  // pisar silenciosamente el resultado de la otra venta.
  const { data: actualizado, error: errorStock } =
    await supabase
      .from("productos")
      .update({
        stock: nuevoStock,
      })
      .eq("id", producto.id)
      .eq("user_id", user.id)
      .eq("stock", productoActual.stock)
      .select("id");

  if (errorStock) {
    await supabase.from("ventas").delete().eq("id", ventaCreada.id);
    throw errorStock;
  }

  if (!actualizado || actualizado.length === 0) {
    await supabase.from("ventas").delete().eq("id", ventaCreada.id);
    throw new Error(
      "El stock de este producto cambió mientras se procesaba la venta. Intenta de nuevo."
    );
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
    // Compare-and-swap, igual que al registrar: si otra venta/compra
    // concurrente sobre el mismo producto cambia el stock justo en este
    // instante, reintenta desde el valor fresco en vez de pisarlo.
    const exito = await ajustarStockConCas(
      venta.producto_id,
      user.id,
      venta.cantidad
    );

    if (!exito) {
      throw new Error(
        "El stock de este producto cambió mientras se procesaba el borrado. Intenta de nuevo."
      );
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