export type TipoMovimientoCaja = "apertura" | "entrada" | "salida" | "cierre";

export interface MovimientoCaja {
  id: number;
  fecha: string;
  tipo: TipoMovimientoCaja;
  monto: number;
  motivo: string | null;
  monto_esperado: number | null;
  diferencia: number | null;
}
