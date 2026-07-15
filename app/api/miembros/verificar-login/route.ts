import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { obtenerSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { verificarUsuarioApi } from "../../../../lib/verificarUsuarioApi";

type Razon = "no_encontrado" | "sin_contrasena" | "contrasena_incorrecta";

// Se llama justo después de iniciar sesión con el correo y la
// contraseña de la cuenta (ver /login): recibe el nombre que escribió
// la persona y SU contraseña, y confirma contra el hash guardado en
// miembros_equipo — nunca se envía el hash al navegador, la
// comparación ocurre acá, en el servidor.
export async function POST(request: Request) {
  const user = await verificarUsuarioApi(request);

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { nombre, password } = await request.json();

  if (typeof nombre !== "string" || typeof password !== "string" || !nombre.trim()) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  try {
    const admin = obtenerSupabaseAdmin();

    const { data, error } = await admin
      .from("miembros_equipo")
      .select("id, nombre, correo, rol, permisos, activo, password_hash")
      .eq("user_id", user.id)
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
      { error: `No se pudo verificar el usuario: ${detalle}` },
      { status: 500 }
    );
  }
}
