import { GraficaGeneral, VentaCruda } from "./types";

export type Periodo = "semanal" | "mensual" | "anual";

export interface Punto {
  nombre: string;
  ventas: number;
}

export interface ProductoAgregado {
  nombre: string;
  ingresos: number;
  unidades: number;
  historial: Punto[];
}

const DIAS_SEMANA = [
  "dom",
  "lun",
  "mar",
  "mié",
  "jue",
  "vie",
  "sáb",
];

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function esMismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Filtra ventas dentro del rango del periodo. offset=0 es el periodo
// actual, offset=1 es el periodo inmediatamente anterior (para comparar %).
export function filtrarPorPeriodo(
  ventas: VentaCruda[],
  periodo: Periodo,
  offset: number = 0
): VentaCruda[] {
  const hoy = new Date();

  if (periodo === "semanal") {
    const fin = new Date(hoy);
    fin.setDate(hoy.getDate() - 7 * offset);
    fin.setHours(23, 59, 59, 999);

    const inicio = new Date(fin);
    inicio.setDate(fin.getDate() - 6);
    inicio.setHours(0, 0, 0, 0);

    return ventas.filter((v) => {
      const f = new Date(v.fecha);
      return f >= inicio && f <= fin;
    });
  }

  if (periodo === "mensual") {
    const objetivo = new Date(
      hoy.getFullYear(),
      hoy.getMonth() - offset,
      1
    );

    return ventas.filter((v) => {
      const f = new Date(v.fecha);
      return (
        f.getFullYear() === objetivo.getFullYear() &&
        f.getMonth() === objetivo.getMonth()
      );
    });
  }

  const anioObjetivo = hoy.getFullYear() - offset;

  return ventas.filter((v) => {
    const f = new Date(v.fecha);
    return f.getFullYear() === anioObjetivo;
  });
}

// Agrupa ventas ya filtradas en puntos para la gráfica principal.
export function agruparPorPeriodo(
  ventas: VentaCruda[],
  periodo: Periodo
): GraficaGeneral[] {
  const hoy = new Date();

  if (periodo === "semanal") {
    const puntos: GraficaGeneral[] = [];

    for (let i = 6; i >= 0; i--) {
      const dia = new Date(hoy);
      dia.setDate(hoy.getDate() - i);

      const total = ventas
        .filter((v) => esMismoDia(new Date(v.fecha), dia))
        .reduce((acc, v) => acc + v.total, 0);

      puntos.push({
        nombre: DIAS_SEMANA[dia.getDay()],
        ventas: total,
      });
    }

    return puntos;
  }

  if (periodo === "mensual") {
    const anio = hoy.getFullYear();
    const mes = hoy.getMonth();
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();

    const puntos: GraficaGeneral[] = [];

    for (let dia = 1; dia <= diasEnMes; dia++) {
      const total = ventas
        .filter((v) => {
          const fecha = new Date(v.fecha);
          return (
            fecha.getFullYear() === anio &&
            fecha.getMonth() === mes &&
            fecha.getDate() === dia
          );
        })
        .reduce((acc, v) => acc + v.total, 0);

      puntos.push({ nombre: String(dia), ventas: total });
    }

    return puntos;
  }

  const anio = hoy.getFullYear();
  const puntos: GraficaGeneral[] = [];

  for (let mes = 0; mes < 12; mes++) {
    const total = ventas
      .filter((v) => {
        const fecha = new Date(v.fecha);
        return (
          fecha.getFullYear() === anio && fecha.getMonth() === mes
        );
      })
      .reduce((acc, v) => acc + v.total, 0);

    puntos.push({ nombre: MESES[mes], ventas: total });
  }

  return puntos;
}

// Agrupa ventas del periodo seleccionado por producto (ingresos/unidades),
// con historial de los últimos 7 días para las mini-gráficas. El historial
// se calcula siempre sobre el historial completo de ventas (ventasTodas),
// sin importar el periodo seleccionado, para que no se corte cuando el
// periodo empieza a menos de 7 días (ej. los primeros días de un mes).
export function agregarPorProducto(
  ventasPeriodo: VentaCruda[],
  ventasTodas: VentaCruda[] = ventasPeriodo
): ProductoAgregado[] {
  const hoy = new Date();
  const mapa = new Map<string, ProductoAgregado>();

  for (const venta of ventasPeriodo) {
    if (!mapa.has(venta.producto)) {
      mapa.set(venta.producto, {
        nombre: venta.producto,
        ingresos: 0,
        unidades: 0,
        historial: [],
      });
    }

    const producto = mapa.get(venta.producto)!;
    producto.ingresos += venta.total;
    producto.unidades += venta.cantidad;
  }

  for (const producto of mapa.values()) {
    for (let i = 6; i >= 0; i--) {
      const dia = new Date(hoy);
      dia.setDate(hoy.getDate() - i);

      const total = ventasTodas
        .filter(
          (v) =>
            v.producto === producto.nombre &&
            esMismoDia(new Date(v.fecha), dia)
        )
        .reduce((acc, v) => acc + v.total, 0);

      producto.historial.push({
        nombre: DIAS_SEMANA[dia.getDay()],
        ventas: total,
      });
    }
  }

  return Array.from(mapa.values()).sort(
    (a, b) => b.ingresos - a.ingresos
  );
}

export function calcularPorcentaje(
  actual: number,
  anterior: number
): number {
  if (anterior === 0) {
    return actual > 0 ? 100 : 0;
  }

  return ((actual - anterior) / anterior) * 100;
}
