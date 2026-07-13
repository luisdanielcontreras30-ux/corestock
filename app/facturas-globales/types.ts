export interface FacturaGlobal {
  id: number;
  fecha_inicio: string;
  fecha_fin: string;
  cantidad_ventas: number;
  total: number;
  nota: string | null;
}
