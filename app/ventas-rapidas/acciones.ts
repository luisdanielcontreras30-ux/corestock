import { supabase } from "../../lib/supabase";
import { registrarVenta } from "../ventas/acciones";
import { Producto, Promocion, MetodoPago } from "../ventas/types";

export async function cargarProductosVentaRapida() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      productos: [] as Producto[],
      promociones: [] as Promocion[],
    };
  }

  const userId = user.id;

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

  return {
    productos: (productos ?? []) as Producto[],
    promociones: (promociones ?? []) as Promocion[],
  };
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

// Cobra el carrito completo: una llamada a registrarVenta() por cada
// producto distinto (la tabla ventas guarda una fila por línea, igual
// que el registro manual desde Ventas) — así se hereda gratis la
// verificación de stock con compare-and-swap que ya tiene esa función.
// Se procesan una por una, no en paralelo, para poder detener el cobro
// en el primer error sin perder de vista cuál artículo falló.
export async function registrarVentaRapida(
  items: ItemCarrito[],
  metodoPago: MetodoPago
) {
  const vendidos: number[] = [];

  for (const item of items) {
    try {
      await registrarVenta(
        item.producto,
        null,
        item.cantidad,
        "",
        item.precioUnitario,
        metodoPago
      );
      vendidos.push(item.producto.id);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      throw new ErrorCobroParcial(mensaje, vendidos);
    }
  }
}
