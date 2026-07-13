export type TipoDescuento = "porcentaje" | "monto";

export interface Producto {
  id: number;
  nombre: string;
}

export interface Promocion {
  id: number;
  nombre: string;
  producto_id: number | null;
  producto: string | null;
  tipo: TipoDescuento;
  valor: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activa: boolean;
}
