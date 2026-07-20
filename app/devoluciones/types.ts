export interface Producto {
  id: number;
  nombre: string;
  stock: number;
  precio_venta: number;
}

export interface Devolucion {
  id: number;
  producto_id: number | null;
  producto: string;
  cantidad: number;
  monto_reembolsado: number;
  motivo: string | null;
  repuso_stock: boolean;
  fecha: string;
}
