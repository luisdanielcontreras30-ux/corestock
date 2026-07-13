import { supabase } from "../../lib/supabase";
import { Producto, Promocion, TipoDescuento } from "./types";

export async function cargarDatos() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      productos: [] as Producto[],
      promociones: [] as Promocion[],
    };
  }

  const userId = user.id;

  const { data: productos, error: errorProductos } = await supabase
    .from("productos")
    .select("id, nombre")
    .eq("user_id", userId)
    .eq("activo", true)
    .order("nombre");

  if (errorProductos) {
    throw errorProductos;
  }

  const { data: promociones, error: errorPromociones } = await supabase
    .from("promociones")
    .select("*")
    .eq("user_id", userId)
    .order("id", { ascending: false });

  if (errorPromociones) {
    throw errorPromociones;
  }

  return {
    productos: (productos ?? []) as Producto[],
    promociones: (promociones ?? []) as Promocion[],
  };
}

export async function crearPromocion(
  nombre: string,
  producto: Producto | null,
  tipo: TipoDescuento,
  valor: number,
  fechaInicio: string,
  fechaFin: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { error } = await supabase.from("promociones").insert({
    nombre: nombre.trim(),
    producto_id: producto?.id ?? null,
    producto: producto?.nombre ?? null,
    tipo,
    valor,
    fecha_inicio: fechaInicio ? new Date(fechaInicio).toISOString() : null,
    fecha_fin: fechaFin ? new Date(fechaFin).toISOString() : null,
    activa: true,
    user_id: user.id,
  });

  if (error) {
    throw error;
  }
}

export async function alternarActivaPromocion(id: number, activa: boolean) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { error } = await supabase
    .from("promociones")
    .update({ activa })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
}

export async function eliminarPromocion(id: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { error } = await supabase
    .from("promociones")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
}
