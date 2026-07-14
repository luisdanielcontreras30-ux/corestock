export interface Cliente {
  id: number;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  notas: string | null;
  token: string;
}

export interface ClienteConResumen extends Cliente {
  compras: number;
  totalGastado: number;
}

export interface CompraCliente {
  id: number;
  fecha: string;
  producto: string;
  cantidad: number;
  precio: number;
  total: number;
}

export interface DatosClienteForm {
  nombre: string;
  telefono: string;
  correo: string;
  notas: string;
}
