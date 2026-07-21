// Borradores de formularios en localStorage — si la página se recarga
// a medio llenar un formulario (nuevo producto, nueva venta, carrito de
// venta rápida), esto deja recuperar lo que ya se había escrito en vez
// de perderlo. Nunca debe tronar la app si localStorage no está
// disponible (modo privado, cuota llena, etc.) — cada función se traga
// el error y sigue como si no hubiera borrador.
export function guardarBorrador<T>(clave: string, datos: T): void {
  try {
    localStorage.setItem(clave, JSON.stringify(datos));
  } catch {
    // No es crítico: en el peor caso, se pierde el borrador.
  }
}

export function leerBorrador<T>(clave: string): T | null {
  try {
    const guardado = localStorage.getItem(clave);
    return guardado ? (JSON.parse(guardado) as T) : null;
  } catch {
    return null;
  }
}

export function borrarBorrador(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch {
    // No hay nada más que hacer si esto falla.
  }
}
