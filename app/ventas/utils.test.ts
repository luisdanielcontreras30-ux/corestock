import { describe, it, expect } from "vitest";
import { formatoMoneda, formatoNumeroMoneda, agruparPorFecha } from "./utils";

describe("formatoMoneda", () => {
  it("agrega separador de miles y dos decimales", () => {
    expect(formatoMoneda(1234.5)).toBe("$1,234.50");
  });

  it("redondea a dos decimales", () => {
    expect(formatoMoneda(10)).toBe("$10.00");
  });

  it("el signo va antes del símbolo de moneda, no después", () => {
    expect(formatoMoneda(-45.5)).toBe("-$45.50");
  });

  it("cero se muestra sin signo", () => {
    expect(formatoMoneda(0)).toBe("$0.00");
  });
});

describe("formatoNumeroMoneda", () => {
  it("igual que formatoMoneda pero sin el símbolo", () => {
    expect(formatoNumeroMoneda(1234.5)).toBe("1,234.50");
  });
});

const ETIQUETAS = {
  hoy: "Hoy",
  ayer: "Ayer",
  ultimos7Dias: "Últimos 7 días",
  anteriores: "Anteriores",
};

// Los cortes de agruparPorFecha son por día calendario (medianoche
// local), no por ventanas móviles de 24h — se construyen las fechas de
// prueba a partir de la medianoche de hoy, igual que la implementación,
// en vez de restar horas/días desde "ahora" (eso sí sería una ventana
// móvil y podría caer en el grupo equivocado según la hora del día en
// que corra el test).
function medianocheHoy(): Date {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
}

function isoADiasDeHoy(dias: number, horas = 12): string {
  const fecha = medianocheHoy();
  fecha.setDate(fecha.getDate() + dias);
  fecha.setHours(horas);
  return fecha.toISOString();
}

describe("agruparPorFecha", () => {
  it("una venta de hoy cae en Hoy", () => {
    const grupos = agruparPorFecha([{ fecha: isoADiasDeHoy(0) }], (v) => v.fecha, ETIQUETAS);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].etiqueta).toBe("Hoy");
  });

  it("una venta de ayer cae en Ayer, no en Últimos 7 días", () => {
    const grupos = agruparPorFecha([{ fecha: isoADiasDeHoy(-1) }], (v) => v.fecha, ETIQUETAS);
    expect(grupos[0].etiqueta).toBe("Ayer");
  });

  it("hace 6 días (el límite) todavía cae en Últimos 7 días", () => {
    const grupos = agruparPorFecha([{ fecha: isoADiasDeHoy(-6) }], (v) => v.fecha, ETIQUETAS);
    expect(grupos[0].etiqueta).toBe("Últimos 7 días");
  });

  it("hace 7 días ya cae en Anteriores, no en Últimos 7 días", () => {
    const grupos = agruparPorFecha([{ fecha: isoADiasDeHoy(-7) }], (v) => v.fecha, ETIQUETAS);
    expect(grupos[0].etiqueta).toBe("Anteriores");
  });

  it("no incluye grupos vacíos en el resultado", () => {
    const grupos = agruparPorFecha([{ fecha: isoADiasDeHoy(0) }], (v) => v.fecha, ETIQUETAS);
    expect(grupos.map((g) => g.etiqueta)).toEqual(["Hoy"]);
  });

  it("reparte varias ventas en sus grupos correctos", () => {
    const grupos = agruparPorFecha(
      [{ fecha: isoADiasDeHoy(0) }, { fecha: isoADiasDeHoy(-1) }, { fecha: isoADiasDeHoy(-10) }],
      (v) => v.fecha,
      ETIQUETAS
    );

    expect(grupos.map((g) => g.etiqueta)).toEqual(["Hoy", "Ayer", "Anteriores"]);
  });

  it("sin ventas, no hay grupos", () => {
    expect(agruparPorFecha([], (v: { fecha: string }) => v.fecha, ETIQUETAS)).toEqual([]);
  });
});
