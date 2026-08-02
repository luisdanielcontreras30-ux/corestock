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
  // Momento en que el trabajo pasó a "cobrado" (lo pone
  // cambiarEstadoTrabajo). null si nunca se cobró, o si se cobró antes
  // de correr supabase_servicios_fecha_cobro.sql. Es lo que usan
  // Dashboard y Gráficas para saber CUÁNDO entró el dinero — "fecha" es
  // la fecha del trabajo, no la del cobro, y no cambia sola.
  fecha_cobro: string | null;
}
