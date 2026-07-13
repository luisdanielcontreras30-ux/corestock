export interface Producto {
  id: number;
  nombre: string;
  stock: number;
}

export interface AjusteStock {
  id: number;
  fecha: string;
  producto_id: number | null;
  producto: string;
  cantidad_ajuste: number;
  stock_anterior: number;
  stock_nuevo: number;
  motivo: string | null;
}
