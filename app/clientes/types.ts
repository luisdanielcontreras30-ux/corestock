export interface Cliente {
  id: number;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  notas: string | null;
  token: string;
  // Llega con supabase_clientes_scorecard.sql. Va opcional a propósito:
  // la consulta usa select("*"), así que si la migración no se ha
  // corrido simplemente no viene, y la pantalla funciona igual sin ella
  // en vez de reventar.
  categoria?: string | null;
}

export interface ClienteConResumen extends Cliente {
  compras: number;
  totalGastado: number;
}

// La calificación ya no se captura a mano: son estrellas por lealtad,
// una por compra, tope 5 — así que se calcula aquí en vez de guardarse
// en una columna que podría quedar desactualizada. null cuando el
// cliente todavía no compra nada, para no mostrar "0 estrellas" como si
// fuera una mala calificación.
export function estrellasPorCompras(compras: number): number | null {
  return compras > 0 ? Math.min(5, compras) : null;
}

export interface CompraCliente {
  id: number;
  fecha: string;
  producto: string;
  cantidad: number;
  precio: number;
  total: number;
}
