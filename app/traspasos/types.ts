export interface Producto {
  id: number;
  nombre: string;
  stock: number;
}

export interface Ubicacion {
  id: number;
  nombre: string;
}

export interface StockUbicacion {
  id: number;
  producto_id: number;
  producto_nombre: string;
  ubicacion_id: number;
  stock: number;
}

export interface Traspaso {
  id: number;
  producto_id: number | null;
  producto_nombre: string;
  ubicacion_origen_id: number | null;
  ubicacion_origen_nombre: string | null;
  ubicacion_destino_id: number | null;
  ubicacion_destino_nombre: string | null;
  cantidad: number;
  fecha: string;
}
