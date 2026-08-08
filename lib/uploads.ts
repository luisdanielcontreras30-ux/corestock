import { supabase } from "./supabase";

const EXTENSION_POR_TIPO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5 MB

export type ErrorSubidaImagen = "tipo_invalido" | "muy_grande" | "fallo_subida";

export interface ResultadoSubidaImagen {
  url: string | null;
  error: ErrorSubidaImagen | null;
}

// Sube una imagen a Supabase Storage validando tipo y tamaño, y usando
// un nombre generado (no el del archivo original) para evitar problemas
// de path traversal o colisiones entre archivos con el mismo nombre.
export async function subirImagenSegura(
  bucket: string,
  archivo: File,
  prefijo: string = ""
): Promise<ResultadoSubidaImagen> {
  const extension = EXTENSION_POR_TIPO[archivo.type];

  if (!extension) {
    return { url: null, error: "tipo_invalido" };
  }

  if (archivo.size > TAMANO_MAXIMO_BYTES) {
    return { url: null, error: "muy_grande" };
  }

  const nombreArchivo = `${prefijo}${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(nombreArchivo, archivo, { contentType: archivo.type });

  if (error) {
    return { url: null, error: "fallo_subida" };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(nombreArchivo);

  return { url: data.publicUrl, error: null };
}
