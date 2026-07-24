// Para comparar texto en busquedas ignorando acentos -- en un catalogo
// en espanol/portugues/frances/italiano es muy comun buscar "Cafe" sin
// tilde y no encontrar el nombre real con un simple toLowerCase().includes().
// NFD separa cada letra acentuada en (letra base + marca de acento);
// el regex de abajo quita esas marcas de acento (rango Unicode U+0300
// a U+036F), dejando solo la letra base.
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
