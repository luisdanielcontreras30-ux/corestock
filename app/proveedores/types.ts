export interface Proveedor {
  id: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  notas: string | null;
  activo: boolean;
  // Las tres llegan con supabase_proveedores_scorecard.sql. Van
  // opcionales a propósito: la consulta usa select("*"), así que si la
  // migración no se ha corrido simplemente no vienen, y la pantalla
  // funciona igual sin ellas en vez de reventar.
  categoria?: string | null;
  calificacion?: number | null;
  dias_entrega?: number | null;
}

export interface ProveedorConResumen extends Proveedor {
  compras: number;
  totalGastado: number;
  // Derivados de la tabla de compras, nunca guardados: un número
  // almacenado se queda viejo en cuanto entra otra compra.
  ultimaCompra: string | null;
  gastoReciente: number;
  gastoAnterior: number;
}

export interface CompraProveedor {
  id: number;
  fecha: string;
  producto: string;
  cantidad: number;
  costo_unitario: number;
  total: number;
}
