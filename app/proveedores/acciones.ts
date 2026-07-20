import { supabase } from "../../lib/supabase";
import { Proveedor, ProveedorConResumen, CompraProveedor } from "./types";

export async function cargarProveedores(userId: string): Promise<ProveedorConResumen[]> {
  // Las 2 consultas son independientes — se piden en paralelo en vez de
  // una tras otra para no sumar sus tiempos de ida y vuelta.
  const [
    { data: proveedores, error: errorProveedores },
    { data: compras, error: errorCompras },
  ] = await Promise.all([
    supabase
      .from("proveedores")
      .select("*")
      .eq("user_id", userId)
      .order("creado_en", { ascending: false }),
    supabase
      .from("compras")
      .select("proveedor_id, total")
      .eq("user_id", userId)
      .not("proveedor_id", "is", null),
  ]);

  if (errorProveedores) throw errorProveedores;
  if (errorCompras) throw errorCompras;

  const resumenPorProveedor = new Map<string, { compras: number; totalGastado: number }>();

  for (const compra of compras ?? []) {
    if (compra.proveedor_id == null) continue;

    const actual = resumenPorProveedor.get(compra.proveedor_id) ?? {
      compras: 0,
      totalGastado: 0,
    };

    actual.compras += 1;
    actual.totalGastado += Number(compra.total);

    resumenPorProveedor.set(compra.proveedor_id, actual);
  }

  return ((proveedores ?? []) as Proveedor[]).map((proveedor) => ({
    ...proveedor,
    compras: resumenPorProveedor.get(proveedor.id)?.compras ?? 0,
    totalGastado: resumenPorProveedor.get(proveedor.id)?.totalGastado ?? 0,
  }));
}

export async function cargarHistorialCompras(
  userId: string,
  proveedorId: string
): Promise<CompraProveedor[]> {
  const { data, error } = await supabase
    .from("compras")
    .select("id, fecha, producto, cantidad, costo_unitario, total")
    .eq("user_id", userId)
    .eq("proveedor_id", proveedorId)
    .order("fecha", { ascending: false });

  if (error) throw error;

  return (data ?? []) as CompraProveedor[];
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
    nombre: nombre.trim(),
    telefono: telefono.trim() || null,
    correo: correo.trim() || null,
    notas: notas.trim() || null,
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
