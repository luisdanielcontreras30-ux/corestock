import Dexie, { Table } from "dexie";
import { MetodoPago } from "../app/ventas/types";
import { TipoMovimientoCaja } from "../app/caja/types";

// Base de datos local (IndexedDB vía Dexie) para operar CoreStock sin
// conexión. Solo guarda lo mínimo necesario para los flujos que deben
// seguir funcionando offline en esta fase: vender (Venta Rápida) y
// registrar movimientos de Caja. Es un espejo/cola, no la fuente de
// verdad — Supabase sigue siendo la fuente de verdad en cuanto hay
// conexión.

export interface ProductoCache {
  id: number;
  nombre: string;
  precio_venta: number;
  costo: number;
  stock: number;
  stock_minimo: number | null;
  activo: boolean;
  imagen: string | null;
  user_id: string;
}

export type EstadoPendiente = "pendiente" | "sincronizado" | "error";

// Guarda exactamente los argumentos que necesita registrarVenta() —
// al sincronizar se reutiliza esa misma función (con su validación de
// stock y su compare-and-swap) en vez de reimplementar la lógica de
// venta por separado.
export interface VentaPendiente {
  uuid: string;
  producto_id: number;
  producto_nombre: string;
  precio_venta_producto: number;
  cliente_id: number | null;
  nombre_cliente: string;
  cantidad: number;
  precio_unitario: number;
  metodo_pago: MetodoPago;
  creado_en: string;
  estado: EstadoPendiente;
  error: string | null;
  user_id: string;
}

export interface CajaPendiente {
  uuid: string;
  tipo: TipoMovimientoCaja;
  monto: number;
  motivo: string | null;
  monto_esperado: number | null;
  diferencia: number | null;
  creado_en: string;
  estado: EstadoPendiente;
  error: string | null;
  user_id: string;
}

class CoreStockDB extends Dexie {
  productos_cache!: Table<ProductoCache, number>;
  ventas_pendientes!: Table<VentaPendiente, string>;
  caja_pendientes!: Table<CajaPendiente, string>;

  constructor() {
    super("corestock");
    this.version(1).stores({
      productos_cache: "id, user_id",
      ventas_pendientes: "uuid, estado, user_id, creado_en",
      caja_pendientes: "uuid, estado, user_id, creado_en",
    });
  }
}

export const db = new CoreStockDB();

export function generarUuid(): string {
  return crypto.randomUUID();
}
