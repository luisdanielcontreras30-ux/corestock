import { supabase } from "../../lib/supabase";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { EmpresaConfig, Miembro, Rol, Permiso } from "./types";

async function obtenerUsuarioActual() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  return user;
}

// ----------------- EMPRESA -----------------

export async function cargarEmpresa(): Promise<EmpresaConfig | null> {
  await obtenerUsuarioActual();

  // Sin filtro por user_id: con un miembro del equipo ya no coincide
  // con su propio auth.uid() (tiene identidad propia — ver
  // supabase_permisos_miembros.sql). RLS solo deja ver la fila del
  // negocio al que pertenece la sesión, sea dueño o miembro.
  const { data, error } = await supabase
    .from("empresa_config")
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as EmpresaConfig | null;
}

export async function guardarEmpresa(
  config: EmpresaConfig
): Promise<void> {
  await obtenerUsuarioActual();

  // A diferencia de un simple filtro, este id sí se escribe en la
  // fila — tiene que ser el del NEGOCIO (que un miembro con permiso
  // "configuracion" puede editar), no el auth.uid() propio del miembro.
  const negocioId = await obtenerNegocioId();

  const { error } = await supabase
    .from("empresa_config")
    .upsert(
      {
        ...config,
        user_id: negocioId,
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw error;
  }
}

// ----------------- MIEMBROS DEL EQUIPO -----------------

export async function cargarMiembros(): Promise<Miembro[]> {
  await obtenerUsuarioActual();

  // Nunca selecciona password_hash: esta consulta corre con la
  // sesión del navegador, y ese hash solo debe pasar por rutas de
  // servidor (app/api/miembros/**). Sin filtro por user_id: RLS exige
  // el permiso "configuracion" para ver esta tabla (ver
  // supabase_permisos_miembros.sql).
  const { data, error } = await supabase
    .from("miembros_equipo")
    .select("id, user_id, nombre, correo, rol, permisos, activo, tiene_contrasena, creado_en")
    .order("creado_en", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as Miembro[];
}

export async function crearMiembro(
  nombre: string,
  correo: string,
  rol: Rol,
  permisos: Permiso[]
): Promise<string> {
  await obtenerUsuarioActual();

  const negocioId = await obtenerNegocioId();

  const { data, error } = await supabase
    .from("miembros_equipo")
    .insert({
      user_id: negocioId,
      nombre,
      correo,
      rol,
      permisos,
      activo: true,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

export async function actualizarMiembro(
  id: string,
  cambios: Partial<Miembro>
): Promise<void> {
  await obtenerUsuarioActual();

  const { error } = await supabase
    .from("miembros_equipo")
    .update(cambios)
    .eq("id", id);

  if (error) {
    throw error;
  }
}

async function obtenerAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Sesión no encontrada.");
  }

  return session.access_token;
}

export type RazonLoginMiembro =
  | "no_encontrado"
  | "sin_contrasena"
  | "contrasena_incorrecta";

export type ResultadoLoginMiembro =
  | { ok: true; userId: string; negocioId: string; tokenHash: string; miembro: Miembro }
  | { ok: false; razon: RazonLoginMiembro };

// Se llama en el login cuando se escribió un nombre de usuario: deja
// entrar a un miembro del equipo con SOLO su propio nombre y su propia
// contraseña — nunca necesita la contraseña de la cuenta principal.
// El servidor confirma nombre+contraseña contra miembros_equipo y
// devuelve un token para abrir sesión (ver supabase.auth.verifyOtp en
// login/page.tsx).
export async function entrarComoMiembro(
  correo: string,
  nombre: string,
  password: string
): Promise<ResultadoLoginMiembro> {
  const respuesta = await fetch("/api/miembros/entrar-como-miembro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correo, nombre, password }),
  });

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(datos.error || "No se pudo iniciar sesión.");
  }

  return datos as ResultadoLoginMiembro;
}

// Se llama desde "Miembros del equipo" (crear/editar) cuando el dueño
// escribe una contraseña para ese miembro. El hash se calcula en el
// servidor (app/api/miembros/set-password) — nunca en el navegador.
export async function establecerContrasenaMiembro(
  miembroId: string,
  password: string
): Promise<void> {
  const token = await obtenerAccessToken();

  const respuesta = await fetch("/api/miembros/set-password", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ miembroId, password }),
  });

  if (!respuesta.ok) {
    const datos = await respuesta.json();
    throw new Error(datos.error || "No se pudo guardar la contraseña.");
  }
}

export async function eliminarMiembro(id: string): Promise<void> {
  await obtenerUsuarioActual();

  const { error } = await supabase
    .from("miembros_equipo")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

// ----------------- CAMBIAR MI PROPIA CONTRASEÑA -----------------

export async function cambiarMiContrasena(
  nuevaContrasena: string
): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: nuevaContrasena,
  });

  if (error) {
    throw error;
  }
}
