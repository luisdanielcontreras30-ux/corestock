import { supabase } from "./supabase";

export interface ResultadoAnalisisIA {
  nombre: string;
  descripcion: string;
}

function archivoABase64(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      const resultado = lector.result as string;
      // "data:image/png;base64,AAAA..." — solo interesa lo de después de la coma.
      const base64 = resultado.split(",")[1] ?? "";
      resolve(base64);
    };
    lector.onerror = () => reject(new Error("No se pudo leer la imagen."));
    lector.readAsDataURL(archivo);
  });
}

export async function analizarProductoConIA(
  archivo: File,
  idioma: string
): Promise<ResultadoAnalisisIA> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Usuario no autenticado");
  }

  const imagenBase64 = await archivoABase64(archivo);

  const respuesta = await fetch("/api/ia/analizar-producto", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ imagenBase64, mimeType: archivo.type, idioma }),
  });

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(datos.error || "No se pudo analizar la imagen.");
  }

  return datos as ResultadoAnalisisIA;
}
