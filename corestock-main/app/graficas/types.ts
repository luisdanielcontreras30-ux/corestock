export interface Venta {
  id: number;
  fecha: string;
  producto: string;
  cantidad: number;
  precio: number;
  total: number;
  cliente?: string;
}

export interface ProductoGrafica {
  id: number;
  nombre: string;
  ventas: number;
  unidades: number;

  historial: {
    nombre: string;
    ventas: number;
  }[];
}

export interface EstadisticasGenerales {
  totalVentas: number;
  ingresos: number;
  productosVendidos: number;
  promedioVenta: number;
}

export interface GraficaGeneral {
  nombre: string;
  ventas: number;
}

export interface VentaCruda {
  fecha: string;
  producto: string;
  cantidad: number;
  total: number;
}
