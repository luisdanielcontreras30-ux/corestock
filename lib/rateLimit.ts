// Limitador de intentos en memoria (best-effort): no persiste entre
// reinicios ni se comparte entre instancias del servidor, pero basta
// para frenar el caso más común de fuerza bruta automatizada contra
// rutas sin sesión (como entrar-como-miembro, que valida su propia
// contraseña y no pasa por el throttling de Supabase Auth).
const intentos = new Map<string, { cuenta: number; expira: number }>();

// Devuelve true cuando la clave (normalmente IP + algo que identifique
// el objetivo del intento) ya superó el máximo permitido dentro de la
// ventana de tiempo — la ventana se reinicia sola al expirar.
export function excedeLimiteIntentos(
  clave: string,
  maxIntentos: number,
  ventanaMs: number
): boolean {
  const ahora = Date.now();
  const registro = intentos.get(clave);

  if (!registro || registro.expira < ahora) {
    intentos.set(clave, { cuenta: 1, expira: ahora + ventanaMs });
    return false;
  }

  registro.cuenta += 1;
  return registro.cuenta > maxIntentos;
}
