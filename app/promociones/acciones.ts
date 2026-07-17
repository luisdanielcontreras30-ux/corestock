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

  // Las 2 consultas son independientes — se piden en paralelo en vez de
  // una tras otra para no sumar sus tiempos de ida y vuelta.
  const [
    { data: productos, error: errorProductos },
    { data: promociones, error: errorPromociones },
  ] = await Promise.all([
    supabase
      .from("productos")
      .select("id, nombre")
      .eq("user_id", userId)
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("promociones")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: false }),
  ]);

  if (errorProductos) throw errorProductos;
  if (errorPromociones) throw errorPromociones;

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

  // Repite del lado del servidor las mismas validaciones que ya hace
  // el formulario (app/promociones/page.tsx) — esta acción es
  // exportada y podría llamarse directamente sin pasar por ese
  // formulario, y un valor fuera de rango aquí produciría un precio
  // más caro en vez de un descuento (ver calcularPrecioConDescuento).
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("Valor de descuento inválido");
  }

  if (tipo === "porcentaje" && valor > 100) {
    throw new Error("El porcentaje de descuento no puede ser mayor a 100");
  }

  if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
    throw new Error("La fecha de fin no puede ser anterior a la fecha de inicio");
  }

  const { error } = await supabase.from("promociones").insert({
    nombre: nombre.trim(),
    producto_id: producto?.id ?? null,
    producto: producto?.nombre ?? null,
    tipo,
    valor,
    fecha_inicio: fechaInicio ? new Date(`${fechaInicio}T00:00:00`).toISOString() : null,
    fecha_fin: fechaFin ? new Date(`${fechaFin}T23:59:59`).toISOString() : null,
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
