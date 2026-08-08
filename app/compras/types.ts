export interface Producto {
  id: number;
  nombre: string;
  costo: number | null;
  stock: number;
}

export interface Proveedor {
  id: string;
  nombre: string;
}

export interface Compra {
  id: number;
  fecha: string;
  producto: string;
  producto_id: number | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  cantidad: number;
  costo_unitario: number;
  total: number;
  nota: string | null;
}
