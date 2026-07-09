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

export interface Venta {
  id: number;
  fecha: string;
  producto: string;
  cantidad: number;
  precio: number;
  total: number;

  producto_id: number;
  cliente_id: number | null;

  clientes?: {
    nombre: string;
  } | null;
}