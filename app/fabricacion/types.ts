export interface Producto {
  id: number;
  nombre: string;
  stock: number;
  precio_venta: number;
}

export interface MateriaPrima {
  id: number;
  nombre: string;
  unidad: string;
  stock: number;
  costo_unitario: number;
}

export interface IngredienteReceta {
  id: number;
  producto_id: number;
  producto_nombre: string;
  materia_prima_id: number;
  materia_prima_nombre: string;
  cantidad_por_unidad: number;
}

export interface Produccion {
  id: number;
  producto_id: number | null;
  producto_nombre: string;
  cantidad: number;
  fecha: string;
}
