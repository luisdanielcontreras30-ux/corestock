// Arma un link de WhatsApp que abre directo el chat de un número (si se
// da uno) en vez del selector de chats del propio usuario — WhatsApp
// solo reconoce el parámetro "phone" con puros dígitos (código de país
// incluido), sin espacios, guiones ni el "+" inicial.
export function limpiarTelefono(telefono: string): string {
  return telefono.replace(/[^\d]/g, "");
}

export function enlaceWhatsApp(mensaje: string, telefono?: string | null): string {
  const numero = telefono ? limpiarTelefono(telefono) : "";
  const base = "https://api.whatsapp.com/send";
  return numero
    ? `${base}?phone=${numero}&text=${encodeURIComponent(mensaje)}`
    : `${base}?text=${encodeURIComponent(mensaje)}`;
}
