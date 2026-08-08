import { supabase } from "../../lib/supabase";
import { ajustarStockConCas } from "../../lib/stockCas";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { escaparIlike } from "../../lib/escaparIlike";
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
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("clientes")
      .select("*")
      .order("nombre"),
    supabase
      .from("ventas")
      .select(`
        *,
        clientes(
          nombre,
          telefono
        )
      `)
      .order("id", {
        ascending: false,
      }),
    // Solo promociones activas — la vigencia por fecha se evalúa al
    // momento de vender (lib/promociones.ts).
    supabase
      .from("promociones")
      .select("id, nombre, producto_id, tipo, valor, fecha_inicio, fecha_fin")
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
  uuid?: string,
  // Solo aplica cuando metodoPago es "credito": cuántos días tiene el
  // cliente para pagar, elegido en el formulario. Se convierte aquí
  // mismo en la fecha límite real que se guarda en la venta.
  plazoDias?: number | null
): Promise<{ id: number } | undefined> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const negocioId = await obtenerNegocioId(user.id);

  if (uuid) {
    const { data: ventaExistente, error: errorExistente } = await supabase
      .from("ventas")
      .select("id")
      .eq("uuid", uuid)
      .maybeSingle();

    if (errorExistente) throw errorExistente;

    // Ya se aplicó en un intento de sincronización anterior: no-op,
    // no se vuelve a vender ni a tocar el stock.
    if (ventaExistente) return { id: ventaExistente.id };
  }

  // La UI (Ventas y Venta Rápida) ya bloquea el botón de confirmar si
  // falta el nombre, pero se revalida aquí también: registrarVenta() es
  // una función cliente común llamable directamente, así que la regla
  // de "crédito siempre necesita saber a quién se le fía" no puede
  // depender solo de que el formulario la respete.
  if (metodoPago === "credito" && nombreCliente.trim() === "") {
    throw new Error("CLIENTE_OBLIGATORIO");
  }

  let clienteId = cliente?.id ?? null;

  if (!clienteId && nombreCliente.trim() !== "") {
    const { data: clienteExistente } =
      await supabase
        .from("clientes")
        .select("*")
        .ilike("nombre", escaparIlike(nombreCliente.trim()))
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
          user_id: negocioId,
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
      .single();

  if (errorProductoActual) {
    throw errorProductoActual;
  }

  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new Error("CANTIDAD_INVALIDA");
  }

  if (productoActual.stock < cantidad) {
    throw new Error("SIN_STOCK");
  }

  // >= 0, no > 0: una promoción de 100% de descuento (ver
  // lib/promociones.ts, sí se permite valor: 100) hace un producto
  // gratis a propósito — precio 0 es un caso válido, no un error.
  if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
    throw new Error("PRECIO_INVALIDO");
  }

  const total =
    precioUnitario * cantidad;

  const fechaVencimiento =
    metodoPago === "credito" && plazoDias
      ? (() => {
          const fecha = new Date();
          fecha.setDate(fecha.getDate() + plazoDias);
          return fecha.toISOString();
        })()
      : null;

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
        // Una venta a crédito empieza sin cobrar — cualquier otro
        // método se da por cobrado de inmediato. Ver módulo Cuentas
        // por Cobrar.
        cobrado: metodoPago !== "credito",
        fecha_vencimiento: fechaVencimiento,
        uuid: uuid ?? null,
        user_id: negocioId,
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
      .eq("stock", productoActual.stock)
      .select("id");

  if (errorStock) {
    await supabase.from("ventas").delete().eq("id", ventaCreada.id);
    throw errorStock;
  }

  if (!actualizado || actualizado.length === 0) {
    await supabase.from("ventas").delete().eq("id", ventaCreada.id);
    throw new Error("STOCK_CAMBIO");
  }

  // Una venta en efectivo es dinero que entra físicamente a la caja —
  // se refleja ahí automáticamente. Si esto falla (ej. Caja no está
  // abierta, o cualquier otro problema), la venta ya quedó registrada
  // y NO se revierte por esto: el dinero de la venta es lo principal,
  // el reflejo en Caja es una comodidad, no debe poder tumbar una
  // venta que por lo demás fue exitosa.
  if (metodoPago === "efectivo") {
    try {
      const { registrarMovimiento } = await import("../caja/acciones");
      await registrarMovimiento(
        "entrada",
        total,
        `Venta #${ventaCreada.id} — ${producto.nombre}`,
        undefined,
        uuid ? `${uuid}-caja` : undefined
      );
    } catch (errorCaja) {
      console.warn(
        "No se pudo reflejar la venta en Caja (la venta sí se registró):",
        errorCaja
      );
    }
  }

  return { id: ventaCreada.id };
}
const CLAVE_LIMPIEZA_VENTAS = "corestock_limpieza_ventas_ultima";
const UMBRAL_LIMPIEZA_VENTAS = 10000;

// Borra ventas de hace más de un mes por debajo de UMBRAL_LIMPIEZA_VENTAS
// — SOLO si el dueño activó "Limpieza automática de ventas" en
// Configuración → Empresa (ver supabase_limpieza_ventas.sql). A
// diferencia de eliminarVenta() (pensada para corregir un error recién
// cometido), esto nunca toca el stock: son ventas de hace semanas o
// meses, y revertir su stock ahora sumaría unidades que ya se movieron
// muchas veces desde entonces — dejaría un stock inflado y falso, no
// una corrección real. Se llama cada vez que se abre Ventas, pero no
// hace nada si ya corrió hoy para este negocio (evita repetir la
// consulta de borrado en cada carga de la página).
export async function limpiarVentasAntiguas(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  let negocioId: string;
  try {
    negocioId = await obtenerNegocioId(user.id);
  } catch (error) {
    console.error(error);
    return;
  }

  const clave = `${CLAVE_LIMPIEZA_VENTAS}_${negocioId}`;
  const hoy = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(clave) === hoy) return;
  localStorage.setItem(clave, hoy);

  try {
    const { data: config, error: errorConfig } = await supabase
      .from("empresa_config")
      .select("limpieza_ventas_activa")
      .maybeSingle();

    if (errorConfig || !config?.limpieza_ventas_activa) return;

    const corte = new Date();
    corte.setMonth(corte.getMonth() - 1);

    const { error: errorBorrar } = await supabase
      .from("ventas")
      .delete()
      .lt("fecha", corte.toISOString())
      .lt("total", UMBRAL_LIMPIEZA_VENTAS);

    if (errorBorrar) throw errorBorrar;
  } catch (error) {
    // Tarea de mantenimiento en segundo plano — nunca debe tumbar ni
    // avisar con un toast de error la carga normal de Ventas.
    console.error(error);
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
    .single();

  if (errorVenta) {
    throw errorVenta;
  }

  let negocioId: string | null = null;
  let stockRevertido = false;

  if (venta.producto_id) {
    negocioId = await obtenerNegocioId(user.id);

    // Compare-and-swap, igual que al registrar: si otra venta/compra
    // concurrente sobre el mismo producto cambia el stock justo en este
    // instante, reintenta desde el valor fresco en vez de pisarlo.
    const exito = await ajustarStockConCas(
      venta.producto_id,
      negocioId,
      venta.cantidad
    );

    if (!exito) {
      throw new Error("STOCK_CAMBIO");
    }

    stockRevertido = true;
  }

  try {
    // .select("id") no es cosmético: sin él, un DELETE que no borra
    // ninguna fila (porque otro dispositivo ya la borró, o porque RLS
    // lo rechaza en silencio) devuelve error null y este código lo da
    // por bueno — con el stock YA revertido más arriba. La venta
    // seguiría en la lista, y cada intento de borrarla volvería a
    // devolver el mismo stock otra vez. Al exigir la fila borrada, el
    // catch de abajo deshace la reversión y la persona ve un error de
    // verdad (mismo patrón que app/compras/acciones.ts).
    const {
      data: eliminada,
      error: errorEliminar,
    } = await supabase
      .from("ventas")
      .delete()
      .eq("id", id)
      .select("id");

    if (errorEliminar) {
      throw errorEliminar;
    }

    if (!eliminada || eliminada.length === 0) {
      throw new Error("YA_ELIMINADA");
    }
  } catch (error) {
    // Si el borrado falla justo después de haber revertido el stock, hay
    // que deshacer esa reversión — si no, la venta sigue existiendo y un
    // reintento del usuario volvería a devolver el mismo stock una
    // segunda vez.
    if (stockRevertido && venta.producto_id && negocioId) {
      const deshecho = await ajustarStockConCas(venta.producto_id, negocioId, -venta.cantidad);
      if (!deshecho) {
        console.error(
          "No se pudo deshacer la reversión de stock tras un fallo al eliminar la venta. Revisar manualmente producto_id=" +
            venta.producto_id
        );
      }
    }
    throw error;
  }
}