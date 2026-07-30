export interface ClienteOpcion {
  id: number;
  nombre: string;
}

export type EstadoTrabajo = "pendiente" | "hecho" | "cobrado";

export interface Trabajo {
  id: number;
  cliente_id: number | null;
  cliente_nombre: string;
  servicio: string;
  fecha: string;
  precio: number;
  estado: EstadoTrabajo;
  notas: string | null;
}
