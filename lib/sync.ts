import { db } from "./db";
import { registrarVenta } from "../app/ventas/acciones";
import { registrarMovimiento } from "../app/caja/acciones";
import { Producto } from "../app/ventas/types";

// Drena las colas de Dexie (ventas_pendientes, caja_pendientes) contra
// Supabase reutilizando las mismas acciones que usa la app cuando hay
// conexión — así se hereda gratis toda su validación (stock,
// compare-and-swap, saldo de caja) en vez de reimplementarla aparte
// para el camino offline.
//
// Se procesa secuencialmente (no en paralelo) y en el orden en que se
// crearon: revive el mismo orden en que un cajero real las hizo, lo
// que importa para el saldo de caja y para no vender el mismo último
// artículo dos veces si dos líneas pendientes compiten por el mismo
// stock.
export interface ResultadoSincronizacion {
  ventasSincronizadas: number;
  ventasConError: number;
  cajaSincronizada: number;
  cajaConError: number;
}

export async function sincronizarPendientes(
  userId: string
): Promise<ResultadoSincronizacion> {
  const resultado: ResultadoSincronizacion = {
    ventasSincronizadas: 0,
    ventasConError: 0,
    cajaSincronizada: 0,
    cajaConError: 0,
  };

  const ventasPendientes = await db.ventas_pendientes
    .where("user_id")
    .equals(userId)
    .and((v) => v.estado === "pendiente")
    .sortBy("creado_en");

  for (const venta of ventasPendientes) {
    try {
      // Objeto mínimo: registrarVenta() relee el stock real desde
      // Supabase antes de vender, así que stock/stock_minimo aquí no
      // se usan para ninguna validación — solo id/nombre/precio.
      const productoStub: Producto = {
        id: venta.producto_id,
        nombre: venta.producto_nombre,
        precio_venta: venta.precio_venta_producto,
        stock: 0,
        stock_minimo: 0,
        imagen: null,
      };

      await registrarVenta(
        productoStub,
        null,
        venta.cantidad,
        venta.nombre_cliente,
        venta.precio_unitario,
        venta.metodo_pago,
        venta.uuid
      );

      await db.ventas_pendientes.update(venta.uuid, {
        estado: "sincronizado",
        error: null,
      });
      resultado.ventasSincronizadas++;
    } catch (error) {
      // No se descarta: queda marcada "error" para que la interfaz la
      // muestre y alguien decida qué hacer (ej. ya no hay stock porque
      // otro dispositivo vendió el último mientras ambos estaban sin
      // conexión — eso es preferible a inventar stock que no existe).
      const mensaje = error instanceof Error ? error.message : String(error);
      await db.ventas_pendientes.update(venta.uuid, {
        estado: "error",
        error: mensaje,
      });
      resultado.ventasConError++;
    }
  }

  const cajaPendientes = await db.caja_pendientes
    .where("user_id")
    .equals(userId)
    .and((c) => c.estado === "pendiente")
    .sortBy("creado_en");

  for (const mov of cajaPendientes) {
    try {
      await registrarMovimiento(
        mov.tipo,
        mov.monto,
        mov.motivo ?? "",
        {
          montoEsperado: mov.monto_esperado ?? undefined,
          diferencia: mov.diferencia ?? undefined,
        },
        mov.uuid
      );

      await db.caja_pendientes.update(mov.uuid, {
        estado: "sincronizado",
        error: null,
      });
      resultado.cajaSincronizada++;
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      await db.caja_pendientes.update(mov.uuid, {
        estado: "error",
        error: mensaje,
      });
      resultado.cajaConError++;
    }
  }

  return resultado;
}

export async function contarPendientes(userId: string): Promise<number> {
  const [ventas, caja] = await Promise.all([
    db.ventas_pendientes
      .where("user_id")
      .equals(userId)
      .and((v) => v.estado === "pendiente")
      .count(),
    db.caja_pendientes
      .where("user_id")
      .equals(userId)
      .and((c) => c.estado === "pendiente")
      .count(),
  ]);

  return ventas + caja;
}

export async function contarConError(userId: string): Promise<number> {
  const [ventas, caja] = await Promise.all([
    db.ventas_pendientes
      .where("user_id")
      .equals(userId)
      .and((v) => v.estado === "error")
      .count(),
    db.caja_pendientes
      .where("user_id")
      .equals(userId)
      .and((c) => c.estado === "error")
      .count(),
  ]);

  return ventas + caja;
}
