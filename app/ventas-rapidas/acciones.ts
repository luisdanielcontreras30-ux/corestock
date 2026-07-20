import { supabase } from "../../lib/supabase";
import { registrarVenta } from "../ventas/acciones";
import { Producto, Promocion, MetodoPago } from "../ventas/types";
import { db, generarUuid, esFalloDeRed } from "../../lib/db";
import { mensajeErrorSeguro } from "../../lib/errores";

// Intenta traer productos y promociones de Supabase; si falla (sin
// conexión, o con conexión pero sin poder alcanzar el servidor — por
// eso no basta con mirar navigator.onLine), cae a la última copia
// guardada en IndexedDB. Cuando la consulta a Supabase sí funciona,
// esa copia se actualiza para la próxima vez que haga falta.
export async function cargarProductosVentaRapida(userId: string) {
  try {
    const [
      { data: productos, error: errorProductos },
      { data: promociones, error: errorPromociones },
    ] = await Promise.all([
      supabase
        .from("productos")
        .select("*")
        .eq("user_id", userId)
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("promociones")
        .select("id, nombre, producto_id, tipo, valor, fecha_inicio, fecha_fin")
        .eq("user_id", userId)
        .eq("activa", true),
    ]);

    if (errorProductos) throw errorProductos;
    if (errorPromociones) throw errorPromociones;

    const productosTipados = (productos ?? []) as Producto[];

    // Espejo de lectura para poder vender sin conexión: reemplaza la
    // copia anterior de este usuario por la que se acaba de traer.
    await db.productos_cache.where("user_id").equals(userId).delete();
    await db.productos_cache.bulkPut(
      productosTipados.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        precio_venta: p.precio_venta,
        costo: 0,
        stock: p.stock,
        stock_minimo: p.stock_minimo,
        activo: true,
        imagen: p.imagen,
        user_id: userId,
      }))
    );

    return {
      productos: productosTipados,
      promociones: (promociones ?? []) as Promocion[],
      desdeCache: false,
    };
  } catch (error) {
    console.warn("Sin conexión con Supabase, usando catálogo guardado localmente:", error);

    const cache = await db.productos_cache.where("user_id").equals(userId).toArray();

    const productos: Producto[] = cache.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      precio_venta: p.precio_venta,
      stock: p.stock,
      stock_minimo: p.stock_minimo ?? 0,
      imagen: p.imagen,
    }));

    // Las promociones no se cachean todavía (Fase 2) — sin conexión se
    // vende al precio de lista, sin descuentos, en vez de arriesgar
    // aplicar una promoción que ya venció.
    return { productos, promociones: [] as Promocion[], desdeCache: true };
  }
}

export interface ItemCarrito {
  producto: Producto;
  cantidad: number;
  precioUnitario: number;
}

// Si el cobro falla a medio carrito, los productos anteriores ya
// quedaron vendidos de verdad (venta insertada + stock descontado).
// Este error lleva la lista de qué productos ya se cobraron para que
// la pantalla los quite del carrito — si no, un reintento del cajero
// los volvería a vender por segunda vez.
export class ErrorCobroParcial extends Error {
  productosVendidos: number[];

  constructor(message: string, productosVendidos: number[]) {
    super(message);
    this.name = "ErrorCobroParcial";
    this.productosVendidos = productosVendidos;
  }
}

// Cobra el carrito completo. Con conexión: una llamada a
// registrarVenta() por producto distinto (igual que siempre, con su
// verificación de stock y compare-and-swap), cada una con un uuid
// propio para que la sincronización sea idempotente si alguna vez se
// reintenta. Sin conexión: encola cada línea en IndexedDB (ver
// lib/sync.ts, que la sincroniza en cuanto vuelve Internet) y
// descuenta el stock del catálogo local de forma optimista, para no
// vender el mismo artículo de más dentro de la misma sesión offline.
export async function registrarVentaRapida(
  items: ItemCarrito[],
  metodoPago: MetodoPago,
  userId: string,
  nombreCliente: string = ""
): Promise<{ encoladoOffline: boolean }> {
  const vendidos: number[] = [];
  let encoladoOffline = false;

  for (const item of items) {
    const uuid = generarUuid();

    try {
      if (!navigator.onLine) {
        throw new Error("SIN_CONEXION");
      }

      await registrarVenta(
        item.producto,
        null,
        item.cantidad,
        nombreCliente,
        item.precioUnitario,
        metodoPago,
        uuid
      );
    } catch (error) {
      // Si de plano no hay conexión, o la venta con conexión falló por
      // un problema de red (no por stock insuficiente ni otra
      // validación real), se encola para sincronizar después en vez de
      // perder la venta.
      if (!esFalloDeRed(error)) {
        const mensaje = mensajeErrorSeguro(error) || String(error);
        throw new ErrorCobroParcial(mensaje, vendidos);
      }

      await db.ventas_pendientes.add({
        uuid,
        producto_id: item.producto.id,
        producto_nombre: item.producto.nombre,
        precio_venta_producto: item.producto.precio_venta,
        cliente_id: null,
        nombre_cliente: nombreCliente,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
        metodo_pago: metodoPago,
        creado_en: new Date().toISOString(),
        estado: "pendiente",
        error: null,
        user_id: userId,
      });

      // Descuento optimista del catálogo local: si el mismo carrito (u
      // otra venta offline inmediatamente después) vuelve a mirar el
      // stock en caché, ya lo ve reducido.
      const productoCache = await db.productos_cache.get(item.producto.id);
      if (productoCache) {
        await db.productos_cache.update(item.producto.id, {
          stock: Math.max(0, productoCache.stock - item.cantidad),
        });
      }

      encoladoOffline = true;
    }

    vendidos.push(item.producto.id);
  }

  return { encoladoOffline };
}
