import { supabase } from "../../lib/supabase";
import { obtenerNegocioId } from "../../lib/negocioActual";
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

  // Las 2 consultas son independientes — se piden en paralelo en vez de
  // una tras otra para no sumar sus tiempos de ida y vuelta.
  const [
    { data: productos, error: errorProductos },
    { data: promociones, error: errorPromociones },
  ] = await Promise.all([
    supabase
      .from("productos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("promociones")
      .select("*")
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
  //
  // Sentinels sin traducir a propósito (ver lib/errores.ts): page.tsx
  // los traduce a los mismos mensajes que ya usa su validación en el
  // navegador, mismo patrón que Traspasos/Cotizaciones/Compras.
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("VALOR_INVALIDO");
  }

  if (tipo === "porcentaje" && valor > 100) {
    throw new Error("PORCENTAJE_INVALIDO");
  }

  if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
    throw new Error("RANGO_FECHAS_INVALIDO");
  }

  const negocioId = await obtenerNegocioId(user.id);

  const { error } = await supabase.from("promociones").insert({
    nombre: nombre.trim(),
    producto_id: producto?.id ?? null,
    producto: producto?.nombre ?? null,
    tipo,
    valor,
    fecha_inicio: fechaInicio ? new Date(`${fechaInicio}T00:00:00`).toISOString() : null,
    fecha_fin: fechaFin ? new Date(`${fechaFin}T23:59:59`).toISOString() : null,
    activa: true,
    user_id: negocioId,
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
    .eq("id", id);

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
    .eq("id", id);

  if (error) {
    throw error;
  }
}
