// Redimensiona una foto en el navegador antes de subirla a Supabase
// Storage. Sin esto, subirImagenSegura() recibía el archivo tal cual
// lo entregaba el selector de archivos — una foto de cámara moderna o
// una captura de pantalla elegida desde la computadora fácilmente pasa
// de los 5 MB que acepta, y se rechazaba sin que la persona entendiera
// por qué "no dejaba subir la foto". Mismo enfoque que ya usa
// lib/iaAcciones.ts para las fotos que se mandan a analizar con IA,
// pero con un lado máximo mayor porque esta sí es la que se guarda y
// se muestra en el catálogo, no solo un insumo para el modelo.
const LADO_MAXIMO_PX = 1600;
const CALIDAD_JPEG = 0.85;

// PNG/WEBP/GIF pueden tener transparencia (el caso típico es un logo
// de negocio con fondo transparente) — forzar todo a JPEG rellenaría
// esas zonas de negro. Solo se reconvierte a JPEG lo que ya venía sin
// canal alfa (fotos), donde además comprime mucho mejor.
const TIPOS_CON_ALFA = new Set(["image/png", "image/webp", "image/gif"]);

export async function redimensionarParaSubir(archivo: File): Promise<File> {
  try {
    const preservarAlfa = TIPOS_CON_ALFA.has(archivo.type);
    const tipoSalida = preservarAlfa ? "image/png" : "image/jpeg";
    const extension = preservarAlfa ? "png" : "jpg";

    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.max(1, Math.round(bitmap.width * escala));
    const alto = Math.max(1, Math.round(bitmap.height * escala));

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas no disponible");

    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, tipoSalida, preservarAlfa ? undefined : CALIDAD_JPEG)
    );

    if (!blob) throw new Error("No se pudo generar la imagen redimensionada");

    const nombre = archivo.name.replace(/\.\w+$/, "") + "." + extension;
    return new File([blob], nombre, { type: tipoSalida });
  } catch (error) {
    // Si el redimensionado falla (formato no soportado por el
    // navegador, etc.) se sube el archivo original tal cual en vez de
    // bloquear el guardado por completo — subirImagenSegura() sigue
    // validando tipo y tamaño de todos modos.
    console.error("No se pudo redimensionar la imagen, se sube el original:", error);
    return archivo;
  }
}
