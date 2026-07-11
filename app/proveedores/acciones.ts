import { supabase } from "../../lib/supabase";
import { Proveedor } from "./types";

export async function cargarProveedores(userId: string): Promise<Proveedor[]> {
  const { data, error } = await supabase
    .from("proveedores")
    .select("*")
    .eq("user_id", userId)
    .order("creado_en", { ascending: false });

  if (error) throw error;

  return (data ?? []) as Proveedor[];
}

export async function crearProveedor(
  userId: string,
  nombre: string,
  telefono: string,
  correo: string,
  notas: string
): Promise<void> {
  const { error } = await supabase.from("proveedores").insert({
    user_id: userId,
    nombre,
    telefono,
    correo,
    notas,
    activo: true,
  });

  if (error) throw error;
}

export async function actualizarProveedor(
  userId: string,
  id: string,
  cambios: Partial<Proveedor>
): Promise<void> {
  const { error } = await supabase
    .from("proveedores")
    .update(cambios)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function eliminarProveedor(
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("proveedores")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}
