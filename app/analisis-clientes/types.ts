export interface SugerenciaCliente {
  clienteId: number;
  nombre: string;
  telefono: string | null;
  compras: number;
  productoTop: string | null;
  mensaje: string;
}
