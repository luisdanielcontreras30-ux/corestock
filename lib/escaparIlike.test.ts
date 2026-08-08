import { describe, it, expect } from "vitest";
import { escaparIlike } from "./escaparIlike";

describe("escaparIlike", () => {
  it("texto normal no cambia", () => {
    expect(escaparIlike("Juan Perez")).toBe("Juan Perez");
  });

  it("escapa % para que no se trate como comodín", () => {
    expect(escaparIlike("100%")).toBe("100\\%");
  });

  it("escapa _ para que no se trate como comodín de un carácter", () => {
    expect(escaparIlike("nombre_usuario")).toBe("nombre\\_usuario");
  });

  it("escapa \\ antes que los demás, para no doble-escapar", () => {
    expect(escaparIlike("a\\b")).toBe("a\\\\b");
  });

  it("combina varios caracteres especiales en el mismo texto", () => {
    expect(escaparIlike("100%_off\\done")).toBe("100\\%\\_off\\\\done");
  });
});
