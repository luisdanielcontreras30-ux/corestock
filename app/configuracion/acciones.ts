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
  const user = await obtenerUsuarioActual();

  // A diferencia de un simple filtro, este id sí se escribe en la
  // fila — tiene que ser el del NEGOCIO (que un miembro con permiso
  // "configuracion" puede editar), no el auth.uid() propio del miembro.
  const negocioId = await obtenerNegocioId(user.id);

  // Los campos de apariencia del catálogo solo se mandan cuando de
  // verdad tienen valor. En una base sin
  // supabase_catalogo_apariencia.sql corrido, mencionarlos haría
  // fallar el guardado ENTERO de la configuración de empresa — nombre,
  // logo y moneda incluidos — por unos colores que nadie ha tocado.
  const fila: Record<string, unknown> = { ...config, user_id: negocioId };
  for (const campo of [
    "catalogo_color_fondo",
    "catalogo_color_producto",
    "catalogo_color_borde",
    "catalogo_color_titulo",
    "catalogo_color_precio",
    "catalogo_color_boton",
    "catalogo_colores_categoria",
  ]) {
    if (fila[campo] === undefined || fila[campo] === null) delete fila[campo];
  }

  const { error } = await supabase
    .from("empresa_config")
    .upsert(fila, { onConflict: "user_id" });

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
  const user = await obtenerUsuarioActual();

  const negocioId = await obtenerNegocioId(user.id);

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
    // 23505 = unique_violation. La interfaz ya revisa duplicados contra
    // la lista cargada en el navegador, pero dos guardados casi
    // simultáneos (dos pestañas/administradores) pueden pasar ese
    // chequeo antes de que cualquiera vea el nuevo miembro del otro —
    // el índice único de la base de datos (ver
    // supabase_miembros_nombre_unico.sql) es el que de verdad lo
    // impide; esto solo traduce ese rechazo al mismo sentinel que ya
    // entiende la pantalla.
    if (error.code === "23505") {
      throw new Error("NOMBRE_DUPLICADO");
    }
    throw error;
  }

  return data.id as string;
}

export async function actualizarMiembro(
  id: string,
  cambios: Partial<Miembro>
): Promise<void> {
  await obtenerUsuarioActual();

  const { data, error } = await supabase
    .from("miembros_equipo")
    .update(cambios)
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      throw new Error("NOMBRE_DUPLICADO");
    }
    throw error;
  }

  // Sin filas afectadas = RLS lo rechazó en silencio — el caso real es
  // un miembro intentando editarse/desactivarse a sí mismo, algo que
  // miembros_equipo_miembro_update bloquea a propósito (ver
  // supabase_permisos_miembros.sql). Sin esto la pantalla mostraba
  // "guardado" aunque en la base no cambió nada.
  if (!data || data.length === 0) {
    throw new Error("NO_SE_PUDO_ACTUALIZAR");
  }
}

// Resuelve, contra el servidor (no contra sessionStorage), si la sesión
// de Supabase Auth actual pertenece a un miembro del equipo (ver
// supabase_refrescar_permisos_miembro.sql) — y si es así, a qué negocio.
// La usan tanto obtenerMiMembresia() (refresco en segundo plano) como
// MiembroActivoProvider al arrancar sin sessionStorage (pestaña nueva,
// PWA reabierta, reinicio del navegador...): la sesión de Auth persiste
// entre esos casos aunque sessionStorage no, así que sin esta consulta
// un miembro terminaba tratado como el dueño (sin restricciones) hasta
// volver a escribir su usuario y contraseña a mano.
// null = esta sesión no corresponde a ningún miembro (ej. es la del
// propio dueño, o el rpc todavía no está desplegado).
export async function obtenerMiMembresiaConNegocio(): Promise<{ miembro: Miembro; negocioId: string } | null> {
  const { data, error } = await supabase.rpc("mi_membresia");

  if (error) {
    // La función puede no existir todavía si no se ha corrido
    // supabase_refrescar_permisos_miembro.sql — no debe tumbar la app
    // por eso, solo se queda sin refrescar.
    console.error(error);
    return null;
  }

  const fila = Array.isArray(data) ? data[0] : data;
  if (!fila) return null;

  const { negocio_id, ...miembro } = fila as Miembro & { negocio_id: string };
  return { miembro: miembro as Miembro, negocioId: negocio_id };
}

export async function obtenerMiMembresia(): Promise<Miembro | null> {
  const resultado = await obtenerMiMembresiaConNegocio();
  return resultado?.miembro ?? null;
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
  | "contrasena_incorrecta"
  | "demasiados_intentos";

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

// Elimina al miembro y cierra cualquier sesión suya que siga abierta
// (ver app/api/miembros/eliminar) — por eso pasa por el servidor en
// vez de borrar la fila directo desde aquí con el cliente anónimo.
export async function eliminarMiembro(id: string): Promise<void> {
  const token = await obtenerAccessToken();

  const respuesta = await fetch("/api/miembros/eliminar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ miembroId: id }),
  });

  if (!respuesta.ok) {
    const datos = await respuesta.json();
    throw new Error(datos.error || "No se pudo eliminar al miembro.");
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
