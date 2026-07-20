export interface ProductoCategoria {
  id: number;
  categoria: string | null;
  precio_venta: number;
  costo: number | null;
}

export interface VentaCategoria {
  fecha: string;
  cantidad: number;
  total: number;
  producto_id: number;
}

export interface PuntoMes {
  mes: string;
  unidades: number;
}

export type Frecuencia = "alta" | "media" | "baja";

export interface EstadisticasCategoria {
  categoria: string;
  tieneProductos: boolean;
  tieneVentas: boolean;
  productosEnCategoria: number;
  unidadesPromedioMes: number;
  precioPromedio: number;
  margenPromedioPct: number | null;
  ingresosPromedioMes: number;
  gananciaEstimadaMensual: number;
  frecuencia: Frecuencia | null;
  ventasPorMes: PuntoMes[];
}

export interface ResultadoIA {
  nombre: string;
  categoria: string;
  descripcion: string;
}
