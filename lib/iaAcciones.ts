import { supabase } from "./supabase";

import type { EstimacionMercado } from "./promptsIA";

export interface ResultadoAnalisisIA {
  nombre: string;
  categoria: string;
  descripcion: string;
  // Lo que el modelo estima del mercado para este tipo de producto.
  // Opcional: las respuestas anteriores a esta función no lo traen, y un
  // modelo puede omitirlo. Ver lib/promptsIA.ts.
  mercado?: EstimacionMercado;
}

// Lleva el status HTTP para que quien llama pueda distinguir "sin
// cuota por ahora" (429) de cualquier otra falla — el llamador usa
// esto para bloquear el botón de análisis con una cuenta regresiva en
// vez de dejar que la persona reintente de inmediato y vuelva a
// chocar con el mismo límite.
export class ErrorAnalisisIA extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ErrorAnalisisIA";
    this.status = status;
  }
}

// Lado más largo al que se reduce la foto antes de mandarla a
// analizar. Gemini no necesita la resolución completa de la cámara
// para describir un producto, y muchos hosts serverless (ej. Vercel)
// rechazan el request completo si el body pasa de ~4.5 MB — una foto
// de celular sin redimensionar (fácil 6-12 MB) lo superaba siempre.
const LADO_MAXIMO_PX = 1280;
const CALIDAD_JPEG = 0.85;

function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      const resultado = lector.result as string;
      // "data:image/jpeg;base64,AAAA..." — solo interesa lo de después de la coma.
      const base64 = resultado.split(",")[1] ?? "";
      resolve(base64);
    };
    lector.onerror = () => reject(new Error("No se pudo leer la imagen."));
    lector.readAsDataURL(blob);
  });
}

async function redimensionarImagen(
  archivo: File
): Promise<{ base64: string; mimeType: string }> {
  try {
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
      canvas.toBlob(resolve, "image/jpeg", CALIDAD_JPEG)
    );

    if (!blob) throw new Error("No se pudo generar la imagen redimensionada");

    return { base64: await blobABase64(blob), mimeType: "image/jpeg" };
  } catch (error) {
    // Si algo del redimensionado falla (formato no soportado por el
    // navegador, etc.), se manda la imagen original tal cual en vez
    // de bloquear el análisis por completo.
    console.error("No se pudo redimensionar la imagen, se envía original:", error);
    return { base64: await blobABase64(archivo), mimeType: archivo.type };
  }
}

export async function analizarProductoConIA(
  archivo: File,
  idioma: string,
  categoriasExistentes: string[] = []
): Promise<ResultadoAnalisisIA> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Usuario no autenticado");
  }

  const { base64: imagenBase64, mimeType } = await redimensionarImagen(archivo);

  const respuesta = await fetch("/api/ia/analizar-producto", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ imagenBase64, mimeType, idioma, categoriasExistentes }),
  });

  let datos: unknown;
  try {
    datos = await respuesta.json();
  } catch {
    throw new ErrorAnalisisIA(
      `El servidor respondió con un error inesperado (HTTP ${respuesta.status}).`,
      respuesta.status
    );
  }

  if (!respuesta.ok) {
    const mensaje = (datos as { error?: string })?.error;
    throw new ErrorAnalisisIA(mensaje || "No se pudo analizar la imagen.", respuesta.status);
  }

  return datos as ResultadoAnalisisIA;
}

// Resultado del análisis con IA de un cliente o proveedor (ver
// app/api/ia/analizar-cliente y analizar-proveedor). mensaje viene
// null cuando compras === 0 — no hay historial del que partir, así
// que no tiene sentido pedirle un mensaje a la IA.
export interface ResultadoAnalisisEntidad {
  compras: number;
  totalGastado: number;
  ticketPromedio: number;
  frecuenciaDias: number | null;
  prediccionMensual: number | null;
  productoTop: string | null;
  diasDesdeUltimaCompra: number | null;
  mensaje: string | null;
}

async function pedirAnalisisEntidad(
  ruta: string,
  cuerpo: Record<string, unknown>
): Promise<ResultadoAnalisisEntidad> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Usuario no autenticado");
  }

  const respuesta = await fetch(ruta, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(cuerpo),
  });

  let datos: unknown;
  try {
    datos = await respuesta.json();
  } catch {
    throw new ErrorAnalisisIA(
      `El servidor respondió con un error inesperado (HTTP ${respuesta.status}).`,
      respuesta.status
    );
  }

  if (!respuesta.ok) {
    const mensaje = (datos as { error?: string })?.error;
    throw new ErrorAnalisisIA(mensaje || "No se pudo analizar.", respuesta.status);
  }

  return datos as ResultadoAnalisisEntidad;
}

export function analizarClienteConIA(clienteId: number, idioma: string): Promise<ResultadoAnalisisEntidad> {
  return pedirAnalisisEntidad("/api/ia/analizar-cliente", { clienteId, idioma });
}

export function analizarProveedorConIA(proveedorId: string, idioma: string): Promise<ResultadoAnalisisEntidad> {
  return pedirAnalisisEntidad("/api/ia/analizar-proveedor", { proveedorId, idioma });
}

// Qué accesos del menú activar para un tipo de negocio (ver
// TipoNegocioProvider) — devuelve [] si la IA no está disponible o no
// se pudo interpretar su respuesta; quien llama decide el respaldo
// (la lista estática de lib/tiposNegocio.ts).
export async function recomendarModulosConIA(descripcion: string, idioma: string): Promise<string[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) return [];

  try {
    const respuesta = await fetch("/api/ia/recomendar-modulos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ descripcion, idioma }),
    });

    if (!respuesta.ok) return [];

    const datos = (await respuesta.json()) as { hrefs?: unknown };
    return Array.isArray(datos.hrefs) ? datos.hrefs.filter((h): h is string => typeof h === "string") : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}
