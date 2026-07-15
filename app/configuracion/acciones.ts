import { supabase } from "../../lib/supabase";
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
  const user = await obtenerUsuarioActual();

  const { data, error } = await supabase
    .from("empresa_config")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as EmpresaConfig | null;
}

export async function guardarEmpresa(
  config: EmpresaConfig
): Promise<void> {
  const user = await obtenerUsuarioActual();

  const { error } = await supabase
    .from("empresa_config")
    .upsert(
      {
        ...config,
        user_id: user.id,
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw error;
  }
}

// ----------------- MIEMBROS DEL EQUIPO -----------------

export async function cargarMiembros(): Promise<Miembro[]> {
  const user = await obtenerUsuarioActual();

  const { data, error } = await supabase
    .from("miembros_equipo")
    .select("*")
    .eq("user_id", user.id)
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
): Promise<void> {
  const user = await obtenerUsuarioActual();

  const { error } = await supabase.from("miembros_equipo").insert({
    user_id: user.id,
    nombre,
    correo,
    rol,
    permisos,
    activo: true,
  });

  if (error) {
    throw error;
  }
}

export async function actualizarMiembro(
  id: string,
  cambios: Partial<Miembro>
): Promise<void> {
  const user = await obtenerUsuarioActual();

  const { error } = await supabase
    .from("miembros_equipo")
    .update(cambios)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
}

// Se usa en el login: valida el nombre que escribió quien inició
// sesión contra los miembros del equipo activos de esa cuenta. No usa
// obtenerUsuarioActual() porque se llama justo después de un
// signInWithPassword exitoso, con el id de usuario ya disponible.
export async function buscarMiembroPorNombre(
  userId: string,
  nombre: string
): Promise<Miembro | null> {
  const { data, error } = await supabase
    .from("miembros_equipo")
    .select("*")
    .eq("user_id", userId)
    .eq("activo", true);

  if (error) {
    throw error;
  }

  const buscado = nombre.trim().toLowerCase();
  const encontrado = ((data ?? []) as Miembro[]).find(
    (m) => m.nombre.trim().toLowerCase() === buscado
  );

  return encontrado ?? null;
}

export async function eliminarMiembro(id: string): Promise<void> {
  const user = await obtenerUsuarioActual();

  const { error } = await supabase
    .from("miembros_equipo")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

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
