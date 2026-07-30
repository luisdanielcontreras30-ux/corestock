export interface Cliente {
  id: number;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  notas: string | null;
  token: string;
  // Llegan con supabase_clientes_scorecard.sql. Van opcionales a
  // propósito: la consulta usa select("*"), así que si la migración no
  // se ha corrido simplemente no vienen, y la pantalla funciona igual
  // sin ellas en vez de reventar.
  categoria?: string | null;
  calificacion?: number | null;
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
