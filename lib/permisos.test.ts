import { describe, it, expect } from "vitest";
import { tienePermiso } from "./permisos";
import { Miembro } from "../app/configuracion/types";

function miembro(permisos: Miembro["permisos"], activo = true): Miembro {
  return {
    id: "m1",
    nombre: "Cajero de prueba",
    correo: null,
    rol: "cajero",
    permisos,
    activo,
    tiene_contrasena: true,
  };
}

describe("tienePermiso", () => {
  it("el dueño de la cuenta (miembroActivo null) puede todo", () => {
    expect(tienePermiso(null, "configuracion")).toBe(true);
    expect(tienePermiso(null, "ver_caja")).toBe(true);
  });

  it("un miembro con el permiso puede", () => {
    expect(tienePermiso(miembro(["ver_ventas", "ver_caja"]), "ver_caja")).toBe(true);
  });

  it("un miembro sin el permiso no puede", () => {
    expect(tienePermiso(miembro(["ver_ventas"]), "ver_caja")).toBe(false);
  });

  it("un miembro sin permisos no puede nada", () => {
    expect(tienePermiso(miembro([]), "configuracion")).toBe(false);
  });

  // No es responsabilidad de tienePermiso() decidir si un miembro
  // inactivo debería seguir teniendo sesión — eso lo maneja
  // MiembroActivoProvider (cierra la sesión al detectarlo). Aquí solo
  // se confirma que el chequeo de permiso en sí no depende de "activo".
  it("no filtra por 'activo' — eso lo decide quien llama", () => {
    expect(tienePermiso(miembro(["ver_caja"], false), "ver_caja")).toBe(true);
  });
});
