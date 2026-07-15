import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { obtenerSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { verificarUsuarioApi } from "../../../../lib/verificarUsuarioApi";

// Establece o cambia la contraseña de un miembro del equipo. Solo el
// dueño de la cuenta (autenticado con su JWT) puede llamar esto, y
// solo sobre miembros que le pertenecen — el hash nunca se calcula ni
// se guarda desde el navegador.
export async function POST(request: Request) {
  const user = await verificarUsuarioApi(request);

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { miembroId, password } = await request.json();

  if (!miembroId || typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      { error: "Falta el miembro o la contraseña debe tener al menos 6 caracteres." },
      { status: 400 }
    );
  }

  try {
    const admin = obtenerSupabaseAdmin();

    // Confirma que el miembro pertenece a quien está llamando antes de
    // tocar nada — sin esto, cualquier cuenta autenticada podría
    // cambiar la contraseña de miembros de otro negocio.
    const { data: miembro, error: errorBusqueda } = await admin
      .from("miembros_equipo")
      .select("id, user_id")
      .eq("id", miembroId)
      .maybeSingle();

    if (errorBusqueda) throw errorBusqueda;

    if (!miembro || miembro.user_id !== user.id) {
      return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    }

    const hash = await bcrypt.hash(password, 10);

    const { error: errorUpdate } = await admin
      .from("miembros_equipo")
      .update({ password_hash: hash })
      .eq("id", miembroId);

    if (errorUpdate) throw errorUpdate;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `No se pudo guardar la contraseña: ${detalle}` },
      { status: 500 }
    );
  }
}
