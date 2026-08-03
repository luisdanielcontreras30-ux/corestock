import { NextResponse } from "next/server";
import { obtenerSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { verificarUsuarioApi } from "../../../../lib/verificarUsuarioApi";
import { resolverNegocioYPermisos } from "../../../../lib/resolverNegocioId";

// Elimina un miembro del equipo y, de paso, invalida cualquier sesión
// suya que siga abierta. Borrar solo la fila de miembros_equipo no
// bastaba: cada miembro tiene su propia identidad de Supabase Auth
// (ver lib/identidadMiembro.ts) y su JWT seguía siendo válido hasta
// que expiraba solo — con RLS bloqueando sus consultas, pero sin
// echarlo de la sesión que ya tenía abierta. admin.auth.admin.deleteUser
// revoca sus tokens de inmediato.
export async function POST(request: Request) {
  const user = await verificarUsuarioApi(request);

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { miembroId } = await request.json();

  if (!miembroId || typeof miembroId !== "string") {
    return NextResponse.json({ error: "Falta el miembro." }, { status: 400 });
  }

  try {
    const admin = obtenerSupabaseAdmin();
    const { negocioId, esMiembro, permisos } = await resolverNegocioYPermisos(user.id);

    if (esMiembro && !permisos.includes("configuracion")) {
      return NextResponse.json({ error: "No tienes permiso para hacer esto." }, { status: 403 });
    }

    // Confirma que el miembro pertenece al mismo negocio que quien
    // llama antes de tocar nada — igual que en set-password.
    const { data: miembro, error: errorBusqueda } = await admin
      .from("miembros_equipo")
      .select("id, user_id, auth_user_id")
      .eq("id", miembroId)
      .maybeSingle();

    if (errorBusqueda) throw errorBusqueda;

    if (!miembro || miembro.user_id !== negocioId) {
      return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    }

    const { error: errorDelete } = await admin
      .from("miembros_equipo")
      .delete()
      .eq("id", miembroId);

    if (errorDelete) throw errorDelete;

    const authUserId = miembro.auth_user_id as string | null;
    if (authUserId) {
      // Si esto falla ya no hay nada que revertir — lo que de verdad
      // protege los datos (la fila de miembros_equipo) ya se borró.
      // Se registra el error nada más para diagnóstico.
      const { error: errorAuth } = await admin.auth.admin.deleteUser(authUserId);
      if (errorAuth) console.error(errorAuth);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "No se pudo eliminar al miembro. Intenta de nuevo en un momento." },
      { status: 500 }
    );
  }
}
