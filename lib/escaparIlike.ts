// Postgres/PostgREST tratan "%" y "_" como comodines dentro de un
// patrón ILIKE (cualquier secuencia y cualquier carácter suelto), y
// "\" como su carácter de escape. Sin esto, buscar por un nombre que
// de casualidad contenga alguno de esos caracteres (ej. un cliente
// llamado algo con "%" o "_") deja de comparase como texto exacto: se
// interpreta como patrón, puede coincidir con más de una fila y hace
// que .maybeSingle() truene, o encontrar al cliente equivocado.
export function escaparIlike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}
