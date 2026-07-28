import { supabase } from "../../lib/supabase";
import { ajustarStockConCas } from "../../lib/stockCas";
import { obtenerNegocioId } from "../../lib/negocioActual";
import {
  Producto,
  Cliente,
  Cotizacion,
  EstadoCotizacion,
  ItemCotizacion,
  ItemNuevo,
} from "./types";

// La tabla cotizacion_items (supabase_cotizaciones_items.sql) puede no
// existir todavía en un proyecto que no ha corrido esa migración. En vez
// de romper Cotizaciones por completo, se detecta y se sigue en modo de
// una sola línea, igual que hace Caja con registrar_movimiento_caja.
function esTablaInexistente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    (error.message ?? "").toLowerCase().includes("could not find the table")
  );
}

let avisoMigracionMostrado = false;

function avisarFaltaMigracion() {
  if (avisoMigracionMostrado) return;
  avisoMigracionMostrado = true;
  console.warn(
    "cotizacion_items no existe todavía en Supabase — Cotizaciones funciona en modo de una sola línea. Corre supabase_cotizaciones_items.sql en el SQL Editor para poder cotizar varios productos, servicios y mano de obra."
  );
}

// Una cotización anterior a cotizacion_items guarda su única línea en
// las columnas de la propia cotización. Se convierte a la misma forma
// que las demás para que la interfaz tenga un solo camino que dibujar.
//
// El id va en negativo a propósito: no corresponde a ninguna fila real
// de cotizacion_items y así nunca puede confundirse con una.
function itemDesdeColumnas(cotizacion: Cotizacion): ItemCotizacion {
  return {
    id: -cotizacion.id,
    cotizacion_id: cotizacion.id,
    tipo: "producto",
    producto_id: cotizacion.producto_id,
    descripcion: cotizacion.producto,
    cantidad: Number(cotizacion.cantidad),
    precio_unitario: Number(cotizacion.precio_unitario),
    total: Number(cotizacion.total),
    orden: 0,
    venta_id: cotizacion.venta_id,
  };
}

export async function cargarDatos() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      productos: [] as Producto[],
      clientes: [] as Cliente[],
      cotizaciones: [] as Cotizacion[],
      // La interfaz necesita saberlo para avisar que hay que correr la
      // migración antes de intentar cotizar varias líneas.
      soportaItems: true,
    };
  }

  // Las 4 consultas son independientes — se piden en paralelo en vez de
  // una tras otra para no sumar sus tiempos de ida y vuelta.
  const [
    { data: productos, error: errorProductos },
    { data: clientes, error: errorClientes },
    { data: cotizaciones, error: errorCotizaciones },
    { data: items, error: errorItems },
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
    supabase
      .from("cotizacion_items")
      .select("*")
      .order("cotizacion_id", { ascending: false })
      .order("orden"),
  ]);

  if (errorProductos) throw errorProductos;
  if (errorClientes) throw errorClientes;
  if (errorCotizaciones) throw errorCotizaciones;

  const soportaItems = !esTablaInexistente(errorItems);

  // Un error que NO sea "la tabla no existe" sí es un problema real y
  // debe verse, no tragarse como si fuera un proyecto sin migrar.
  if (errorItems && !soportaItems) {
    avisarFaltaMigracion();
  } else if (errorItems) {
    throw errorItems;
  }

  const porCotizacion = new Map<number, ItemCotizacion[]>();

  for (const fila of (items ?? []) as ItemCotizacion[]) {
    const lista = porCotizacion.get(fila.cotizacion_id) ?? [];
    lista.push({
      ...fila,
      cantidad: Number(fila.cantidad),
      precio_unitario: Number(fila.precio_unitario),
      total: Number(fila.total),
    });
    porCotizacion.set(fila.cotizacion_id, lista);
  }

  const conItems = ((cotizaciones ?? []) as Cotizacion[]).map((cotizacion) => {
    const propias = porCotizacion.get(cotizacion.id);
    return {
      ...cotizacion,
      items: propias && propias.length > 0 ? propias : [itemDesdeColumnas(cotizacion)],
    };
  });

  return {
    productos: (productos ?? []) as Producto[],
    clientes: (clientes ?? []) as Cliente[],
    cotizaciones: conItems,
    soportaItems,
  };
}

export function totalDeItems(items: { cantidad: number; precio_unitario: number }[]): number {
  return items.reduce((suma, item) => suma + item.cantidad * item.precio_unitario, 0);
}

function validarItems(items: ItemNuevo[]) {
  if (items.length === 0) {
    throw new Error("SIN_CONCEPTOS");
  }

  for (const item of items) {
    if (!Number.isFinite(item.cantidad) || item.cantidad <= 0) {
      throw new Error("CANTIDAD_INVALIDA");
    }

    if (!Number.isFinite(item.precio_unitario) || item.precio_unitario < 0) {
      throw new Error("PRECIO_INVALIDO");
    }

    // Un concepto sin nombre deja una cotización que el cliente no
    // puede leer. En las líneas de producto el nombre lo pone el
    // catálogo, así que esto solo puede pasar en servicios y mano de obra.
    if (!item.descripcion.trim()) {
      throw new Error("DESCRIPCION_VACIA");
    }
  }
}

export async function crearCotizacion(
  clienteId: number | null,
  clienteNombre: string,
  items: ItemNuevo[],
  nota: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  validarItems(items);

  const total = totalDeItems(items);
  const negocioId = await obtenerNegocioId(user.id);
  const primera = items[0];

  // Las columnas de una sola línea se siguen llenando con un resumen:
  // así el Excel, las consultas directas a la tabla y cualquier lectura
  // vieja siguen viendo algo coherente en vez de ceros.
  const { data: creada, error } = await supabase
    .from("cotizaciones")
    .insert({
      fecha: new Date().toISOString(),
      producto: primera.descripcion,
      producto_id: primera.tipo === "producto" ? primera.producto_id : null,
      cliente_id: clienteId,
      cliente_nombre: clienteNombre.trim() || null,
      cantidad: primera.cantidad,
      precio_unitario: primera.precio_unitario,
      total,
      estado: "pendiente",
      nota: nota.trim() || null,
      user_id: negocioId,
    })
    .select("id")
    .single();

  if (error) throw error;

  const { error: errorItems } = await supabase.from("cotizacion_items").insert(
    items.map((item, indice) => ({
      cotizacion_id: creada.id,
      user_id: negocioId,
      tipo: item.tipo,
      producto_id: item.tipo === "producto" ? item.producto_id : null,
      descripcion: item.descripcion.trim(),
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      total: item.cantidad * item.precio_unitario,
      orden: indice,
    }))
  );

  if (errorItems) {
    // Una sola línea de producto cabe entera en las columnas de arriba,
    // así que la cotización ya quedó bien guardada aunque la tabla de
    // líneas no exista: no hay nada que deshacer ni nada que avisar.
    const cabeEnLasColumnas = items.length === 1 && items[0].tipo === "producto";

    if (esTablaInexistente(errorItems) && cabeEnLasColumnas) {
      avisarFaltaMigracion();
      return;
    }

    // En cualquier otro caso la cotización quedaría a medias — con la
    // primera línea y sin las demás. Se deshace y se reporta: callar
    // aquí perdería en silencio todo lo que la persona capturó.
    await supabase.from("cotizaciones").delete().eq("id", creada.id);

    if (esTablaInexistente(errorItems)) {
      avisarFaltaMigracion();
      throw new Error("FALTA_MIGRACION_ITEMS");
    }

    throw errorItems;
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

  const { data: actualizada, error } = await supabase
    .from("cotizaciones")
    .update({ estado })
    .eq("id", id)
    .select("id");

  if (error) {
    throw error;
  }

  // Sin filas actualizadas el cambio no ocurrió (otra pestaña la borró,
  // o RLS lo rechazó sin error). Avisar es mejor que pintar el estado
  // nuevo en pantalla sobre algo que en la base sigue igual.
  if (!actualizada || actualizada.length === 0) {
    throw new Error("YA_ELIMINADA");
  }
}

// Convierte una cotización aceptada en ventas reales, conservando los
// precios cotizados (no los precios actuales, que pudieron cambiar).
//
// Con varias líneas hay tres cosas que antes no existían:
//
//  • Cada línea genera su propia venta. Las de servicio y mano de obra
//    también: son ingreso real, solo que sin producto que descontar.
//  • El stock se agrupa POR PRODUCTO antes de validar. Dos líneas del
//    mismo producto tienen que sumar contra las mismas existencias; si
//    se validaran por separado, 2 líneas de 6 pasarían con 8 en stock.
//  • Si algo falla a media conversión hay que deshacer TODO lo aplicado
//    hasta ese punto: las ventas creadas y cada descuento de stock.
export async function convertirEnVenta(cotizacionParam: Cotizacion) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  // Se relee de la base en vez de confiar en el objeto que trae el
  // cliente: si otra pestaña (o un doble clic) ya convirtió esta misma
  // cotización, el estado que tiene el navegador puede estar obsoleto.
  const { data: cotizacion, error: errorCotizacion } = await supabase
    .from("cotizaciones")
    .select("*")
    .eq("id", cotizacionParam.id)
    .single();

  if (errorCotizacion) throw errorCotizacion;

  if (cotizacion.estado !== "aceptada") {
    throw new Error("NO_ACEPTADA");
  }

  if (cotizacion.venta_id) {
    throw new Error("YA_CONVERTIDA");
  }

  const { data: itemsGuardados, error: errorItems } = await supabase
    .from("cotizacion_items")
    .select("*")
    .eq("cotizacion_id", cotizacion.id)
    .order("orden");

  if (errorItems && !esTablaInexistente(errorItems)) throw errorItems;

  const items: ItemCotizacion[] =
    itemsGuardados && itemsGuardados.length > 0
      ? (itemsGuardados as ItemCotizacion[]).map((item) => ({
          ...item,
          cantidad: Number(item.cantidad),
          precio_unitario: Number(item.precio_unitario),
          total: Number(item.total),
        }))
      : [itemDesdeColumnas(cotizacion as Cotizacion)];

  for (const item of items) {
    if (item.cantidad <= 0) {
      throw new Error("CANTIDAD_INVALIDA");
    }

    if (item.tipo === "producto" && !item.producto_id) {
      throw new Error("PRODUCTO_NO_EXISTE");
    }
  }

  const negocioId = await obtenerNegocioId(user.id);

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

  // Cuántas unidades hacen falta de cada producto, sumando todas las
  // líneas que lo mencionan. Validar línea por línea dejaría pasar una
  // cotización de 2 líneas × 6 unidades con solo 8 en existencia.
  const necesidades = new Map<number, number>();

  for (const item of items) {
    if (item.tipo !== "producto" || !item.producto_id) continue;
    necesidades.set(item.producto_id, (necesidades.get(item.producto_id) ?? 0) + item.cantidad);
  }

  for (const [productoId, cantidad] of necesidades) {
    const { data: producto, error: errorProducto } = await supabase
      .from("productos")
      .select("stock")
      .eq("id", productoId)
      .single();

    if (errorProducto) throw errorProducto;

    if (producto.stock < cantidad) {
      throw new Error("STOCK_INSUFICIENTE_CONVERSION");
    }
  }

  // A partir de aquí se empieza a escribir. Todo lo que se aplique se
  // anota para poder deshacerlo si algo falla más adelante.
  const ventasCreadas: number[] = [];
  const stockDescontado: [number, number][] = [];

  try {
    for (const item of items) {
      const { data: ventaCreada, error: errorVenta } = await supabase
        .from("ventas")
        .insert({
          fecha: new Date().toISOString(),
          producto: item.descripcion,
          // Servicios y mano de obra no salen del catálogo: la venta
          // queda sin producto_id y por eso no toca ninguna existencia.
          producto_id: item.tipo === "producto" ? item.producto_id : null,
          cliente_id: clienteId,
          cantidad: item.cantidad,
          precio: item.precio_unitario,
          total: item.cantidad * item.precio_unitario,
          user_id: negocioId,
        })
        .select("id")
        .single();

      if (errorVenta) throw errorVenta;

      ventasCreadas.push(ventaCreada.id);
    }

    for (const [productoId, cantidad] of necesidades) {
      const descontado = await ajustarStockConCas(productoId, negocioId, -cantidad);
      if (!descontado) throw new Error("STOCK_CAMBIO");
      stockDescontado.push([productoId, cantidad]);
    }

    // Guardado con el mismo candado compare-and-swap: solo se marca
    // convertida si sigue "aceptada" y sin venta_id — si otra pestaña
    // ganó la carrera entre la lectura fresca de arriba y este punto,
    // aquí no actualiza ninguna fila y se revierte todo en el catch.
    const { data: cotizacionActualizada, error: errorActualizarCotizacion } = await supabase
      .from("cotizaciones")
      .update({ venta_id: ventasCreadas[0] })
      .eq("id", cotizacion.id)
      .eq("estado", "aceptada")
      .is("venta_id", null)
      .select("id");

    if (errorActualizarCotizacion) throw errorActualizarCotizacion;

    if (!cotizacionActualizada || cotizacionActualizada.length === 0) {
      throw new Error("YA_CONVERTIDA");
    }
  } catch (error) {
    // Deshacer en orden inverso: primero devolver el stock, después
    // borrar las ventas. Si no, quedarían existencias reducidas sin
    // ninguna venta que lo explique Y la cotización sin vincular,
    // lista para volver a descontar en el siguiente intento.
    for (const [productoId, cantidad] of stockDescontado) {
      try {
        const revertido = await ajustarStockConCas(productoId, negocioId, cantidad);
        if (!revertido) {
          console.error(
            "No se pudo revertir el stock tras un fallo al convertir la cotización. Revisar manualmente producto_id=" +
              productoId
          );
        }
      } catch (errorRevertir) {
        console.error(
          "No se pudo revertir el stock tras un fallo al convertir la cotización. Revisar manualmente producto_id=" +
            productoId,
          errorRevertir
        );
      }
    }

    for (const ventaId of ventasCreadas) {
      await supabase.from("ventas").delete().eq("id", ventaId);
    }

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

  // Las líneas se van solas por el "on delete cascade" de la migración.
  const { data: eliminada, error } = await supabase
    .from("cotizaciones")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    throw error;
  }

  if (!eliminada || eliminada.length === 0) {
    throw new Error("YA_ELIMINADA");
  }
}
