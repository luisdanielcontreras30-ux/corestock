export type EstadoCotizacion = "pendiente" | "aceptada" | "rechazada";

export interface Producto {
  id: number;
  nombre: string;
  precio_venta: number;
}

export interface Cliente {
  id: number;
  nombre: string;
}

export interface Cotizacion {
  id: number;
  fecha: string;
  cliente_id: number | null;
  cliente_nombre: string | null;
  producto_id: number | null;
  producto: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  estado: EstadoCotizacion;
  nota: string | null;
  venta_id: number | null;
}
