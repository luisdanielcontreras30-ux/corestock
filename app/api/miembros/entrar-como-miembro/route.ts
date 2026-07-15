import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { obtenerSupabaseAdmin } from "../../../../lib/supabaseAdmin";

type Razon = "cuenta_no_encontrada" | "no_encontrado" | "sin_contrasena" | "contrasena_incorrecta";

// Deja entrar a un miembro del equipo con SOLO su propio nombre y su
// propia contraseña — nunca necesita la contraseña de la cuenta
// principal. En vez de eso, una vez que se confirma el nombre y la
// contraseña contra miembros_equipo, se genera un magic link con la
// Admin API (sin enviar ningún correo) y se le devuelve al navegador
// el token para que abra la sesión con verifyOtp.
export async function POST(request: Request) {
  const { correo, nombre, password } = await request.json();

  if (!correo || typeof nombre !== "string" || typeof password !== "string" || !nombre.trim()) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  try {
    const admin = obtenerSupabaseAdmin();

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: correo,
    });

    if (linkError || !linkData?.user) {
      return NextResponse.json({ ok: false, razon: "cuenta_no_encontrada" as Razon });
    }

    const userId = linkData.user.id as string;

    const { data, error } = await admin
      .from("miembros_equipo")
      .select("id, nombre, correo, rol, permisos, activo, password_hash")
      .eq("user_id", userId)
      .eq("activo", true);

    if (error) throw error;

    const buscado = nombre.trim().toLowerCase();
    const miembro = (data ?? []).find(
      (m) => (m.nombre as string).trim().toLowerCase() === buscado
    );

    if (!miembro) {
      return NextResponse.json({ ok: false, razon: "no_encontrado" as Razon });
    }

    if (!miembro.password_hash) {
      return NextResponse.json({ ok: false, razon: "sin_contrasena" as Razon });
    }

    const coincide = await bcrypt.compare(password, miembro.password_hash as string);

    if (!coincide) {
      return NextResponse.json({ ok: false, razon: "contrasena_incorrecta" as Razon });
    }

    return NextResponse.json({
      ok: true,
      userId,
      tokenHash: linkData.properties.hashed_token,
      miembro: {
        id: miembro.id,
        nombre: miembro.nombre,
        correo: miembro.correo,
        rol: miembro.rol,
        permisos: miembro.permisos,
        activo: miembro.activo,
        tiene_contrasena: true,
      },
    });
  } catch (error) {
    console.error(error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `No se pudo iniciar sesión: ${detalle}` },
      { status: 500 }
    );
  }
}
