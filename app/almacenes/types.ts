export interface Almacen {
  id: number;
  nombre: string;
  descripcion: string | null;
  foto_url: string | null;
}

export interface ProductoEnAlmacen {
  producto_id: number;
  nombre: string;
  stock: number;
}
