// navigator.clipboard.writeText falla silenciosamente (promesa
// rechazada) en contextos no seguros (http sin TLS) o cuando el
// navegador bloquea el permiso — sin este try/catch, el botón de
// "copiar" no hacía nada visible al fallar.
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = texto;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const exito = document.execCommand("copy");
      document.body.removeChild(textarea);
      return exito;
    } catch {
      return false;
    }
  }
}
