// Empleados IA y el Vendedor de WhatsApp todavía están en pruebas —
// mientras se terminan de afinar, solo deben verse (en la navegación
// y al entrar directo por la URL) para esta cuenta. El resto de los
// negocios ni se enteran de que existen hasta que se abran de verdad.
const RUTAS_BETA_CERRADA = ["/whatsapp", "/empleados-ia"];
const CORREOS_CON_ACCESO_BETA = ["daniel@gmail.com"];

export function esRutaBetaCerrada(ruta: string): boolean {
  return RUTAS_BETA_CERRADA.some((r) => ruta === r || ruta.startsWith(`${r}/`));
}

export function tieneAccesoBeta(email: string | null | undefined): boolean {
  return !!email && CORREOS_CON_ACCESO_BETA.includes(email.toLowerCase());
}
