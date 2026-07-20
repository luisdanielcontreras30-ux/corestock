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
  metodoPago: MetodoPago = "efectivo",
  // Presente solo cuando la venta viene de la cola offline (ver
  // lib/sync.ts) — es la llave de idempotencia: si esta misma venta ya
  // se sincronizó antes (por ejemplo, la conexión se cortó justo
  // después del insert, antes de que la respuesta llegara), se detecta
  // aquí y no se vuelve a insertar ni a descontar stock una segunda vez.
  uuid?: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  if (uuid) {
    const { data: ventaExistente, error: errorExistente } = await supabase
      .from("ventas")
      .select("id")
      .eq("uuid", uuid)
      .eq("user_id", user.id)
      .maybeSingle();

    if (errorExistente) throw errorExistente;

    // Ya se aplicó en un intento de sincronización anterior: no-op,
    // no se vuelve a vender ni a tocar el stock.
    if (ventaExistente) return;
  }

  // La UI (Ventas y Venta Rápida) ya bloquea el botón de confirmar si
  // falta el nombre, pero se revalida aquí también: registrarVenta() es
  // una función cliente común llamable directamente, así que la regla
  // de "préstamo siempre necesita saber a quién se le fía" no puede
  // depender solo de que el formulario la respete.
  if (metodoPago === "prestamo" && nombreCliente.trim() === "") {
    throw new Error("Para vender a préstamo debes indicar el nombre del cliente.");
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

  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new Error("La cantidad debe ser mayor a 0.");
  }

  if (productoActual.stock < cantidad) {
    throw new Error("No hay suficiente stock para esta venta.");
  }

  // >= 0, no > 0: una promoción de 100% de descuento (ver
  // lib/promociones.ts, sí se permite valor: 100) hace un producto
  // gratis a propósito — precio 0 es un caso válido, no un error.
  if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
    throw new Error("El precio de venta no puede ser negativo.");
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
        // Una venta a préstamo empieza sin cobrar — cualquier otro
        // método se da por cobrado de inmediato. Ver módulo Cuentas
        // por Cobrar.
        cobrado: metodoPago !== "prestamo",
        uuid: uuid ?? null,
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