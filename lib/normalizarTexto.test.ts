import { describe, it, expect } from "vitest";
import { normalizarTexto } from "./normalizarTexto";

describe("normalizarTexto", () => {
  it("quita acentos", () => {
    expect(normalizarTexto("Café")).toBe("cafe");
  });

  it("baja a minúsculas", () => {
    expect(normalizarTexto("REFRESCO")).toBe("refresco");
  });

  it("cubre acentos de varios idiomas (es/pt/fr/it)", () => {
    expect(normalizarTexto("Açaí")).toBe("acai");
    expect(normalizarTexto("Château")).toBe("chateau");
    expect(normalizarTexto("Città")).toBe("citta");
  });

  it("texto ya sin acentos no cambia (salvo mayúsculas)", () => {
    expect(normalizarTexto("Detergente")).toBe("detergente");
  });

  it("string vacío no truena", () => {
    expect(normalizarTexto("")).toBe("");
  });
});
