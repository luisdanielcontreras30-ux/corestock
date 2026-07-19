import { NextResponse } from "next/server";
import { verificarUsuarioApi } from "../../../../lib/verificarUsuarioApi";
import { analizarImagenProducto } from "../../../../lib/googleAI";

// Tope generoso pero acotado sobre el tamaño de la imagen en base64,
// para no dejar pasar payloads gigantes hacia la API de Google (la
// subida de imágenes de producto en sí ya limita a 5 MB en binario).
const TAMANO_MAXIMO_BASE64 = 8 * 1024 * 1024;

const TIPOS_PERMITIDOS = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const user = await verificarUsuarioApi(request);

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido." }, { status: 400 });
  }

  const { imagenBase64, mimeType, idioma } = (cuerpo ?? {}) as {
    imagenBase64?: unknown;
    mimeType?: unknown;
    idioma?: unknown;
  };

  if (typeof imagenBase64 !== "string" || !imagenBase64) {
    return NextResponse.json({ error: "Falta la imagen a analizar." }, { status: 400 });
  }

  if (typeof mimeType !== "string" || !TIPOS_PERMITIDOS.has(mimeType)) {
    return NextResponse.json({ error: "Tipo de imagen no soportado." }, { status: 400 });
  }

  if (imagenBase64.length > TAMANO_MAXIMO_BASE64) {
    return NextResponse.json({ error: "La imagen es demasiado grande." }, { status: 400 });
  }

  try {
    const resultado = await analizarImagenProducto(
      imagenBase64,
      mimeType,
      typeof idioma === "string" ? idioma : "es"
    );
    return NextResponse.json(resultado);
  } catch (error) {
    console.error(error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `No se pudo analizar la imagen: ${detalle}` },
      { status: 500 }
    );
  }
}
