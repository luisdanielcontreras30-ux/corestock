export type EstadoCotizacion = "pendiente" | "aceptada" | "rechazada";

// Una cotización ya no es "un producto x una cantidad": puede mezclar
// mercancía del inventario con trabajo cobrado. Un autolavado cotiza
// "detallado de interior x1" (servicio) más "cera para carro x1"
// (producto), y un taller le suma "3 horas de mano de obra".
//
// La diferencia entre los tres no es cosmética: solo 'producto'
// descuenta stock al convertir la cotización en venta. Un servicio no
// tiene existencias que bajar.
export type TipoItem = "producto" | "servicio" | "mano_obra";

export interface Producto {
  id: number;
  nombre: string;
  precio_venta: number;
}

export interface Cliente {
  id: number;
  nombre: string;
}

export interface ItemCotizacion {
  id: number;
  cotizacion_id: number;
  tipo: TipoItem;
  // Solo en las líneas de tipo 'producto'. Null si el producto se borró
  // después: la descripción conserva el nombre que tenía.
  producto_id: number | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  orden: number;
  venta_id: number | null;
}

// Lo que el formulario arma antes de guardar: todavía no tiene id ni
// cotizacion_id porque la cotización no existe.
export interface ItemNuevo {
  tipo: TipoItem;
  producto_id: number | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

export interface Cotizacion {
  id: number;
  fecha: string;
  cliente_id: number | null;
  cliente_nombre: string | null;
  // Las columnas de una sola línea siguen existiendo y siguen
  // llenándose con un resumen (la primera línea, o "N conceptos"),
  // para que nada de lo que ya leía la cotización se rompa: el Excel,
  // las cotizaciones viejas y cualquier consulta directa a la tabla.
  producto_id: number | null;
  producto: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  estado: EstadoCotizacion;
  nota: string | null;
  venta_id: number | null;
  // Siempre trae al menos una línea: si la cotización es anterior a
  // cotizacion_items (o esa migración no está aplicada), se sintetiza
  // una a partir de las columnas de arriba. Así la interfaz tiene una
  // sola forma de dibujar cualquier cotización.
  items: ItemCotizacion[];
}
