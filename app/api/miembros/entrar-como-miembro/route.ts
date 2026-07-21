import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { obtenerSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { asegurarAuthUserId, correoSinteticoMiembro } from "../../../../lib/identidadMiembro";

type Razon = "no_encontrado" | "sin_contrasena" | "contrasena_incorrecta";

// generateLink({ type: "magiclink" }) NO es de solo lectura: si el
// correo no tiene cuenta todavía, la Admin API la crea de una — así lo
// documenta el propio SDK ("generateLink() handles the creation of
// the user for signup, invite and magiclink"). Esta ruta no requiere
// sesión, así que sin este chequeo previo cualquiera podría crear
// cuentas reales de Supabase para correos ajenos con solo mandar un
// POST. Se busca primero si el correo ya existe (listUsers, sin
// efectos secundarios) y solo se llama a generateLink si sí — para un
// correo que ya existe el resultado es idéntico al de antes.
async function buscarUsuarioPorCorreo(
  admin: ReturnType<typeof obtenerSupabaseAdmin>,
  correo: string
) {
  const objetivo = correo.trim().toLowerCase();
  const perPage = 200;

  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const encontrado = data.users.find(
      (u: { email?: string }) => u.email?.toLowerCase() === objetivo
    );
    if (encontrado) return encontrado;

    if (data.users.length < perPage) return null;
  }
}

// Deja entrar a un miembro del equipo con SOLO su propio nombre y su
// propia contraseña — nunca necesita la contraseña de la cuenta
// principal. La contraseña se valida contra miembros_equipo.password_hash
// (bcrypt, igual que siempre); si la validación pasa, se genera un
// magic link apuntado a la identidad de Supabase Auth PROPIA de ese
// miembro (no la del dueño — ver lib/identidadMiembro.ts), creándola
// primero si es la primera vez que entra. Así cada miembro termina con
// su propio auth.uid() real, que RLS sí puede distinguir del dueño
// (ver supabase_permisos_miembros.sql).
export async function POST(request: Request) {
  const { correo, nombre, password } = await request.json();

  if (!correo || typeof nombre !== "string" || typeof password !== "string" || !nombre.trim()) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  try {
    const admin = obtenerSupabaseAdmin();

    const duenoExistente = await buscarUsuarioPorCorreo(admin, correo);

    // Mismo "no_encontrado" que el resto de los casos de esta función
    // (correo sin cuenta, nombre sin coincidencia, etc.) — una
    // respuesta distinta para cada caso permitiría a cualquiera (sin
    // haber iniciado sesión) comprobar si un correo tiene cuenta en
    // CoreStock probando aquí.
    if (!duenoExistente) {
      return NextResponse.json({ ok: false, razon: "no_encontrado" as Razon });
    }

    const negocioId = duenoExistente.id as string;

    const { data, error } = await admin
      .from("miembros_equipo")
      .select("id, nombre, correo, rol, permisos, activo, password_hash, auth_user_id")
      .eq("user_id", negocioId)
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

    const authUserId = await asegurarAuthUserId(
      miembro.id as string,
      (miembro.auth_user_id as string | null) ?? null
    );

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: correoSinteticoMiembro(miembro.id as string),
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      throw linkError ?? new Error("No se pudo generar el enlace de acceso.");
    }

    return NextResponse.json({
      ok: true,
      userId: authUserId,
      negocioId,
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
    // Ruta sin sesión (la usa alguien que todavía no inició sesión) —
    // el detalle técnico de la excepción no debe salir de los logs del
    // servidor hacia una respuesta que cualquiera, sin autenticarse,
    // puede provocar.
    console.error(error);
    return NextResponse.json(
      { error: "No se pudo iniciar sesión. Intenta de nuevo en un momento." },
      { status: 500 }
    );
  }
}
