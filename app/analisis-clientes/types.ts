export interface SugerenciaCliente {
  clienteId: number;
  nombre: string;
  telefono: string | null;
  compras: number;
  productoTop: string | null;
  totalGastado: number;
  ticketPromedio: number;
  frecuenciaDias: number | null;
  prediccionMensual: number | null;
  mensaje: string;
}
