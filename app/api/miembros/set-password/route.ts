import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { obtenerSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { verificarUsuarioApi } from "../../../../lib/verificarUsuarioApi";
import { resolverNegocioYPermisos } from "../../../../lib/resolverNegocioId";
import { asegurarAuthUserId } from "../../../../lib/identidadMiembro";

// Establece o cambia la contraseña de un miembro del equipo. Puede
// llamarlo el dueño o un miembro con permiso "configuracion" — nunca
// otro miembro (antes de que cada uno tuviera su propia identidad de
// Supabase, esta ruta solo comprobaba "pertenece a la misma cuenta",
// lo cual dejaba de alcanzar en cuanto un miembro sin permisos podía
// tener el mismo auth.uid() que el dueño). El hash nunca se calcula ni
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

    const { negocioId, esMiembro, permisos } = await resolverNegocioYPermisos(user.id);

    if (esMiembro && !permisos.includes("configuracion")) {
      return NextResponse.json({ error: "No tienes permiso para hacer esto." }, { status: 403 });
    }

    // Confirma que el miembro pertenece al mismo negocio que quien
    // llama antes de tocar nada — sin esto, cualquier cuenta con
    // permiso "configuracion" podría cambiar la contraseña de
    // miembros de otro negocio.
    const { data: miembro, error: errorBusqueda } = await admin
      .from("miembros_equipo")
      .select("id, user_id, auth_user_id")
      .eq("id", miembroId)
      .maybeSingle();

    if (errorBusqueda) throw errorBusqueda;

    if (!miembro || miembro.user_id !== negocioId) {
      return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    }

    const hash = await bcrypt.hash(password, 10);

    const { error: errorUpdate } = await admin
      .from("miembros_equipo")
      .update({ password_hash: hash })
      .eq("id", miembroId);

    if (errorUpdate) throw errorUpdate;

    // Ya con contraseña, este miembro puede entrar — asegura que tenga
    // su propia identidad de Supabase Auth lista desde ahora (si no,
    // se crea en su primer login igual, esto solo evita esa demora).
    await asegurarAuthUserId(miembroId, (miembro.auth_user_id as string | null) ?? null);

    return NextResponse.json({ ok: true });
  } catch (error) {
    // El detalle técnico (texto crudo de Postgres, a veces con nombres
    // de tabla/columna) queda solo en los logs del servidor — al
    // cliente le llega un mensaje genérico, igual que en el resto de
    // las rutas de la API.
    console.error(error);
    return NextResponse.json(
      { error: "No se pudo guardar la contraseña. Intenta de nuevo en un momento." },
      { status: 500 }
    );
  }
}
