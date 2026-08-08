// Limitador de intentos en memoria (best-effort): no persiste entre
// reinicios ni se comparte entre instancias del servidor, pero basta
// para frenar el caso más común de fuerza bruta automatizada contra
// rutas sin sesión (como entrar-como-miembro, que valida su propia
// contraseña y no pasa por el throttling de Supabase Auth).
const intentos = new Map<string, { cuenta: number; expira: number }>();

// Sin esto el Map solo crece: cada IP+correo distinto deja una entrada
// que nadie borra aunque su ventana ya haya vencido hace horas, así que
// un atacante rotando correos podría inflar la memoria del servidor.
// Se limpia de forma perezosa (al escribir una entrada nueva) en vez de
// con un temporizador, para no dejar un intervalo corriendo en un
// entorno serverless.
const MAX_ENTRADAS_ANTES_DE_LIMPIAR = 1000;

function limpiarVencidos(ahora: number) {
  for (const [clave, registro] of intentos) {
    if (registro.expira < ahora) intentos.delete(clave);
  }
}

// Devuelve true cuando la clave (normalmente IP + algo que identifique
// el objetivo del intento) ya superó el máximo permitido dentro de la
// ventana de tiempo — la ventana se reinicia sola al expirar.
//
// Solo debe llamarse para CONTAR un intento fallido: los aciertos se
// limpian con olvidarIntentos() para que alguien que entra bien muchas
// veces seguidas (un mismo mostrador con varios turnos, por ejemplo) no
// termine bloqueado como si estuviera adivinando contraseñas.
export function excedeLimiteIntentos(
  clave: string,
  maxIntentos: number,
  ventanaMs: number
): boolean {
  const ahora = Date.now();
  const registro = intentos.get(clave);

  if (!registro || registro.expira < ahora) {
    if (intentos.size >= MAX_ENTRADAS_ANTES_DE_LIMPIAR) limpiarVencidos(ahora);
    intentos.set(clave, { cuenta: 1, expira: ahora + ventanaMs });
    return false;
  }

  registro.cuenta += 1;
  return registro.cuenta > maxIntentos;
}

// Comprueba el límite sin contar el intento — se usa ANTES de validar,
// para rechazar de una a quien ya se pasó, sin que ese rechazo sume.
export function limiteAlcanzado(clave: string, maxIntentos: number): boolean {
  const registro = intentos.get(clave);
  if (!registro || registro.expira < Date.now()) return false;
  return registro.cuenta > maxIntentos;
}

// Borra el historial de una clave tras un intento exitoso.
export function olvidarIntentos(clave: string) {
  intentos.delete(clave);
}
