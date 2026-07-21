export interface Producto {
  id: number;
  nombre: string;
  precio_venta: number;
  stock: number;
  stock_minimo: number;
  imagen: string | null;
}

export interface Cliente {
  id: number;
  nombre: string;
  telefono?: string | null;
}

export interface Promocion {
  id: number;
  nombre: string;
  producto_id: number | null;
  tipo: "porcentaje" | "monto";
  valor: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
}

export type MetodoPago = "efectivo" | "tarjeta" | "transferencia" | "prestamo" | "otro";

export interface Venta {
  id: number;
  fecha: string;
  producto: string;
  cantidad: number;
  precio: number;
  total: number;
  metodo_pago: MetodoPago;
  // Solo es relevante cuando metodo_pago es "prestamo" — indica si esa
  // venta fiada ya se cobró. Cualquier otro método siempre queda en
  // true (ver registrarVenta()). Usado por el módulo Cuentas por Cobrar.
  cobrado: boolean;

  producto_id: number;
  cliente_id: number | null;

  clientes?: {
    nombre: string;
    telefono: string | null;
  } | null;
}