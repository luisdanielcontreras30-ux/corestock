import { supabase } from "../../lib/supabase";
import { ajustarStockConCas } from "../../lib/stockCas";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { Producto, Cliente, Cotizacion, EstadoCotizacion } from "./types";

export async function cargarDatos() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      productos: [] as Producto[],
      clientes: [] as Cliente[],
      cotizaciones: [] as Cotizacion[],
    };
  }

  // Las 3 consultas son independientes — se piden en paralelo en vez de
  // una tras otra para no sumar sus tiempos de ida y vuelta.
  const [
    { data: productos, error: errorProductos },
    { data: clientes, error: errorClientes },
    { data: cotizaciones, error: errorCotizaciones },
  ] = await Promise.all([
    supabase
      .from("productos")
      .select("id, nombre, precio_venta")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("clientes")
      .select("id, nombre")
      .order("nombre"),
    supabase
      .from("cotizaciones")
      .select("*")
      .order("id", { ascending: false }),
  ]);

  if (errorProductos) throw errorProductos;
  if (errorClientes) throw errorClientes;
  if (errorCotizaciones) throw errorCotizaciones;

  return {
    productos: (productos ?? []) as Producto[],
    clientes: (clientes ?? []) as Cliente[],
    cotizaciones: (cotizaciones ?? []) as Cotizacion[],
  };
}

export async function crearCotizacion(
  producto: Producto,
  clienteId: number | null,
  clienteNombre: string,
  cantidad: number,
  precioUnitario: number,
  nota: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  if (cantidad <= 0) {
    throw new Error("La cantidad debe ser mayor a 0.");
  }

  if (precioUnitario < 0) {
    throw new Error("El precio no puede ser negativo.");
  }

  const total = cantidad * precioUnitario;
  const negocioId = await obtenerNegocioId();

  const { error } = await supabase.from("cotizaciones").insert({
    fecha: new Date().toISOString(),
    producto: producto.nombre,
    producto_id: producto.id,
    cliente_id: clienteId,
    cliente_nombre: clienteNombre.trim() || null,
    cantidad,
    precio_unitario: precioUnitario,
    total,
    estado: "pendiente",
    nota: nota.trim() || null,
    user_id: negocioId,
  });

  if (error) {
    throw error;
  }
}

export async function cambiarEstadoCotizacion(
  id: number,
  estado: EstadoCotizacion
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { error } = await supabase
    .from("cotizaciones")
    .update({ estado })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

// Convierte una cotización aceptada en una venta real, conservando el
// precio cotizado (no el precio actual del producto, que pudo cambiar
// desde entonces). Descuenta stock con el mismo candado
// compare-and-swap que usa el resto de la app.
export async function convertirEnVenta(cotizacion: Cotizacion) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  if (cotizacion.estado !== "aceptada") {
    throw new Error("Solo puedes convertir cotizaciones aceptadas.");
  }

  if (cotizacion.venta_id) {
    throw new Error("Esta cotización ya se convirtió en una venta.");
  }

  if (!cotizacion.producto_id) {
    throw new Error("El producto de esta cotización ya no existe.");
  }

  const productoId = cotizacion.producto_id;

  if (cotizacion.cantidad <= 0) {
    throw new Error("Esta cotización tiene una cantidad inválida.");
  }

  const negocioId = await obtenerNegocioId();

  let clienteId = cotizacion.cliente_id;

  if (!clienteId && cotizacion.cliente_nombre) {
    const { data: clienteExistente, error: errorBusquedaCliente } = await supabase
      .from("clientes")
      .select("id")
      .ilike("nombre", cotizacion.cliente_nombre)
      .maybeSingle();

    if (errorBusquedaCliente) throw errorBusquedaCliente;

    if (clienteExistente) {
      clienteId = clienteExistente.id;
    } else {
      const { data: nuevoCliente, error: errorCliente } = await supabase
        .from("clientes")
        .insert({ nombre: cotizacion.cliente_nombre, user_id: negocioId })
        .select("id")
        .single();

      if (errorCliente) throw errorCliente;

      clienteId = nuevoCliente.id;
    }
  }

  const { data: productoActual, error: errorProducto } = await supabase
    .from("productos")
    .select("stock")
    .eq("id", productoId)
    .single();

  if (errorProducto) throw errorProducto;

  if (productoActual.stock < cotizacion.cantidad) {
    throw new Error("No hay suficiente stock para convertir esta cotización en venta.");
  }

  const { data: ventaCreada, error: errorVenta } = await supabase
    .from("ventas")
    .insert({
      fecha: new Date().toISOString(),
      producto: cotizacion.producto,
      producto_id: cotizacion.producto_id,
      cliente_id: clienteId,
      cantidad: cotizacion.cantidad,
      precio: cotizacion.precio_unitario,
      total: cotizacion.total,
      user_id: negocioId,
    })
    .select("id")
    .single();

  if (errorVenta) throw errorVenta;

  let stockDescontado = false;

  try {
    const nuevoStock = productoActual.stock - cotizacion.cantidad;

    const { data: actualizado, error: errorStock } = await supabase
      .from("productos")
      .update({ stock: nuevoStock })
      .eq("id", productoId)
      .eq("stock", productoActual.stock)
      .select("id");

    if (errorStock) throw errorStock;

    if (!actualizado || actualizado.length === 0) {
      throw new Error("El stock de este producto cambió mientras se procesaba. Intenta de nuevo.");
    }

    stockDescontado = true;

    const { error: errorActualizarCotizacion } = await supabase
      .from("cotizaciones")
      .update({ venta_id: ventaCreada.id })
      .eq("id", cotizacion.id);

    if (errorActualizarCotizacion) throw errorActualizarCotizacion;
  } catch (error) {
    // Si el stock ya se había descontado antes de que fallara el paso
    // siguiente, hay que devolverlo — de lo contrario queda reducido
    // permanentemente sin ninguna venta real que lo explique, y encima
    // la cotización (que nunca quedó vinculada a esta venta) podría
    // reintentarse y descontar el stock una segunda vez.
    if (stockDescontado) {
      // Envuelto aparte: si el propio intento de revertir lanza (en vez
      // de simplemente devolver false), no debe impedir que se borre la
      // venta a medio crear ni que se relance el error original de abajo.
      try {
        const revertido = await ajustarStockConCas(productoId, negocioId, cotizacion.cantidad);
        if (!revertido) {
          console.error(
            "No se pudo revertir el stock tras un fallo al convertir la cotización en venta. Revisar manualmente producto_id=" +
              productoId
          );
        }
      } catch (errorRevertir) {
        console.error(
          "No se pudo revertir el stock tras un fallo al convertir la cotización en venta. Revisar manualmente producto_id=" +
            productoId,
          errorRevertir
        );
      }
    }
    await supabase.from("ventas").delete().eq("id", ventaCreada.id);
    throw error;
  }
}

export async function eliminarCotizacion(id: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { error } = await supabase
    .from("cotizaciones")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}
