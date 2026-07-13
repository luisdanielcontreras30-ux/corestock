export type TipoMovimientoConciliacion = "cargo" | "abono";

export interface MovimientoConciliacion {
  id: number;
  fecha: string;
  descripcion: string;
  tipo: TipoMovimientoConciliacion;
  monto: number;
  conciliado: boolean;
}
