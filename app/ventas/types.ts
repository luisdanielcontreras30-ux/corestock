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

export type MetodoPago = "efectivo" | "tarjeta" | "transferencia" | "otro";

export interface Venta {
  id: number;
  fecha: string;
  producto: string;
  cantidad: number;
  precio: number;
  total: number;
  metodo_pago: MetodoPago;

  producto_id: number;
  cliente_id: number | null;

  clientes?: {
    nombre: string;
  } | null;
}