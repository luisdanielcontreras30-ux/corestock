export interface Proveedor {
  id: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  notas: string | null;
  activo: boolean;
}

export interface ProveedorConResumen extends Proveedor {
  compras: number;
  totalGastado: number;
}

export interface CompraProveedor {
  id: number;
  fecha: string;
  producto: string;
  cantidad: number;
  costo_unitario: number;
  total: number;
}
