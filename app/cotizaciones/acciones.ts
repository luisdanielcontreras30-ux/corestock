import { supabase } from "../../lib/supabase";
import { Producto, Cliente, Cotizacion, EstadoCotizacion } from "./types";

export async function cargarDatos() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      productos: [] as Producto[],
      clientes: [] as Cliente[],
      cotizaciones: [] as Cotizacion[],
    };
  }

  const userId = user.id;

  const { data: productos, error: errorProductos } = await supabase
    .from("productos")
    .select("id, nombre, precio_venta")
    .eq("user_id", userId)
    .eq("activo", true)
    .order("nombre");

  if (errorProductos) {
    throw errorProductos;
  }

  const { data: clientes, error: errorClientes } = await supabase
    .from("clientes")
    .select("id, nombre")
    .eq("user_id", userId)
    .order("nombre");

  if (errorClientes) {
    throw errorClientes;
  }

  const { data: cotizaciones, error: errorCotizaciones } = await supabase
    .from("cotizaciones")
    .select("*")
    .eq("user_id", userId)
    .order("id", { ascending: false });

  if (errorCotizaciones) {
    throw errorCotizaciones;
  }

  return {
    productos: (productos ?? []) as Producto[],
    clientes: (clientes ?? []) as Cliente[],
    cotizaciones: (cotizaciones ?? []) as Cotizacion[],
  };
}

export async function crearCotizacion(
  producto: Producto,
  clienteId: number | null,
  clienteNombre: string,
  cantidad: number,
  precioUnitario: number,
  nota: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const total = cantidad * precioUnitario;

  const { error } = await supabase.from("cotizaciones").insert({
    fecha: new Date().toISOString(),
    producto: producto.nombre,
    producto_id: producto.id,
    cliente_id: clienteId,
    cliente_nombre: clienteNombre.trim() || null,
    cantidad,
    precio_unitario: precioUnitario,
    total,
    estado: "pendiente",
    nota: nota.trim() || null,
    user_id: user.id,
  });

  if (error) {
    throw error;
  }
}

export async function cambiarEstadoCotizacion(
  id: number,
  estado: EstadoCotizacion
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { error } = await supabase
    .from("cotizaciones")
    .update({ estado })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
}

export async function eliminarCotizacion(id: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { error } = await supabase
    .from("cotizaciones")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
}
