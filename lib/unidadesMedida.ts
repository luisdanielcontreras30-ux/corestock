// Catalogo fijo de unidades de medida para materias primas -- antes
// era un campo de texto libre (cada quien escribia "kg", "Kilos",
// "kilogramo"...), lo que hacia imposible traducirlo de forma
// consistente. Se guarda la CLAVE (ej. "kg"), no la etiqueta ya
// traducida, para que se vea correctamente sin importar el idioma
// activo en cada momento.
export const UNIDADES_MEDIDA = [
  "kg",
  "g",
  "l",
  "ml",
  "pieza",
  "caja",
  "paquete",
  "docena",
  "metro",
  "libra",
  "onza",
  "galon",
] as const;

export type UnidadMedida = (typeof UNIDADES_MEDIDA)[number];

const CLAVES = new Set<string>(UNIDADES_MEDIDA);

// Traduce la unidad si es una de las claves fijas del catalogo; si es
// texto libre de una materia prima creada antes de que esto fuera un
// catalogo fijo (ej. "cajas de 12"), se muestra tal cual en vez de
// perder esa informacion.
export function etiquetaUnidad(unidad: string, t: (clave: string) => string): string {
  if (CLAVES.has(unidad)) return t(`unidad.${unidad}`);
  return unidad;
}
