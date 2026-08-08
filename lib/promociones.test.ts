import { describe, it, expect } from "vitest";
import {
  obtenerPromocionAplicable,
  calcularPrecioConDescuento,
  PromocionAplicable,
} from "./promociones";

function promo(over: Partial<PromocionAplicable> = {}): PromocionAplicable {
  return {
    id: 1,
    nombre: "Promo de prueba",
    producto_id: null,
    tipo: "porcentaje",
    valor: 10,
    fecha_inicio: null,
    fecha_fin: null,
    ...over,
  };
}

describe("obtenerPromocionAplicable", () => {
  it("sin promociones, no aplica ninguna", () => {
    expect(obtenerPromocionAplicable(1, [])).toBeNull();
  });

  it("prioriza la promoción específica del producto sobre la general", () => {
    const general = promo({ id: 1, producto_id: null });
    const especifica = promo({ id: 2, producto_id: 5 });
    expect(obtenerPromocionAplicable(5, [general, especifica])?.id).toBe(2);
  });

  it("usa la general si no hay una específica para el producto", () => {
    const general = promo({ id: 1, producto_id: null });
    expect(obtenerPromocionAplicable(5, [general])?.id).toBe(1);
  });

  it("ignora una promoción que todavía no empieza", () => {
    const futura = promo({ fecha_inicio: new Date(Date.now() + 86_400_000).toISOString() });
    expect(obtenerPromocionAplicable(1, [futura])).toBeNull();
  });

  it("ignora una promoción que ya venció", () => {
    const vencida = promo({ fecha_fin: new Date(Date.now() - 86_400_000).toISOString() });
    expect(obtenerPromocionAplicable(1, [vencida])).toBeNull();
  });

  it("una promoción específica de OTRO producto no bloquea la general de este", () => {
    const especificaOtroProducto = promo({ id: 1, producto_id: 99 });
    const general = promo({ id: 2, producto_id: null });
    expect(obtenerPromocionAplicable(5, [especificaOtroProducto, general])?.id).toBe(2);
  });
});

describe("calcularPrecioConDescuento", () => {
  it("sin promoción, el precio no cambia", () => {
    expect(calcularPrecioConDescuento(100, null)).toBe(100);
  });

  it("porcentaje: aplica el descuento normal", () => {
    expect(calcularPrecioConDescuento(100, promo({ tipo: "porcentaje", valor: 25 }))).toBe(75);
  });

  it("porcentaje 100 = producto gratis", () => {
    expect(calcularPrecioConDescuento(100, promo({ tipo: "porcentaje", valor: 100 }))).toBe(0);
  });

  it("porcentaje fuera de rango (>100) se recorta a 100, nunca da precio negativo", () => {
    expect(calcularPrecioConDescuento(100, promo({ tipo: "porcentaje", valor: 250 }))).toBe(0);
  });

  it("porcentaje negativo se recorta a 0 — nunca encarece el producto", () => {
    expect(calcularPrecioConDescuento(100, promo({ tipo: "porcentaje", valor: -20 }))).toBe(100);
  });

  it("monto: resta el valor fijo", () => {
    expect(calcularPrecioConDescuento(100, promo({ tipo: "monto", valor: 30 }))).toBe(70);
  });

  it("monto mayor al precio nunca da un total negativo", () => {
    expect(calcularPrecioConDescuento(50, promo({ tipo: "monto", valor: 999 }))).toBe(0);
  });

  it("monto negativo se recorta a 0 — nunca encarece el producto", () => {
    expect(calcularPrecioConDescuento(100, promo({ tipo: "monto", valor: -50 }))).toBe(100);
  });
});
