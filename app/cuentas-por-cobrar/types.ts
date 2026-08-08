export interface VentaFiada {
  id: number;
  fecha: string;
  producto: string;
  cantidad: number;
  total: number;
  cliente_id: number | null;
  fecha_vencimiento: string | null;
  clientes?: {
    nombre: string;
  } | null;
}

export interface DeudaCliente {
  clienteId: number | null;
  nombre: string;
  totalPendiente: number;
  ventas: VentaFiada[];
}
