import { supabase } from "../../lib/supabase";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { Almacen, ProductoEnAlmacen } from "./types";

export async function cargarDatos() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { almacenes: [] as Almacen[], productosPorAlmacen: new Map<number, ProductoEnAlmacen[]>() };
  }

  // Las dos consultas son independientes — en paralelo en vez de una
  // tras otra. stock_ubicaciones trae el producto ya unido (igual que
  // en app/traspasos/acciones.ts) para no tener que cruzarlo a mano.
  const [{ data: almacenes, error: errorAlmacenes }, { data: filasStock, error: errorStock }] = await Promise.all([
    supabase.from("ubicaciones").select("id, nombre, descripcion, foto_url").order("nombre"),
    supabase
      .from("stock_ubicaciones")
      .select("producto_id, ubicacion_id, stock, productos(nombre)")
      .gt("stock", 0),
  ]);

  if (errorAlmacenes) throw errorAlmacenes;
  if (errorStock) throw errorStock;

  const productosPorAlmacen = new Map<number, ProductoEnAlmacen[]>();

  for (const fila of (filasStock ?? []) as {
    producto_id: number;
    ubicacion_id: number;
    stock: number;
    productos: { nombre: string } | { nombre: string }[] | null;
  }[]) {
    const relacion = fila.productos;
    const nombre = Array.isArray(relacion) ? relacion[0]?.nombre : relacion?.nombre;
    if (!nombre) continue;

    const lista = productosPorAlmacen.get(fila.ubicacion_id) ?? [];
    lista.push({ producto_id: fila.producto_id, nombre, stock: fila.stock });
    productosPorAlmacen.set(fila.ubicacion_id, lista);
  }

  return { almacenes: (almacenes ?? []) as Almacen[], productosPorAlmacen };
}

export async function crearAlmacen(nombre: string, descripcion: string, fotoUrl: string | null) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuario no autenticado");

  if (!nombre.trim()) {
    throw new Error("NOMBRE_VACIO");
  }

  const negocioId = await obtenerNegocioId(user.id);

  const { error } = await supabase.from("ubicaciones").insert({
    nombre: nombre.trim(),
    descripcion: descripcion.trim() || null,
    foto_url: fotoUrl,
    user_id: negocioId,
  });

  if (error) throw error;
}

export async function actualizarAlmacen(
  id: number,
  nombre: string,
  descripcion: string,
  fotoUrl: string | null
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuario no autenticado");

  if (!nombre.trim()) {
    throw new Error("NOMBRE_VACIO");
  }

  const { data, error } = await supabase
    .from("ubicaciones")
    .update({ nombre: nombre.trim(), descripcion: descripcion.trim() || null, foto_url: fotoUrl })
    .eq("id", id)
    .select("id");

  if (error) throw error;

  // Sin filas afectadas = RLS lo rechazó en silencio (almacén de otro
  // negocio) — sin esto se mostraba como guardado aunque en la base no
  // cambió nada.
  if (!data || data.length === 0) {
    throw new Error("NO_SE_PUDO_ACTUALIZAR");
  }
}

export async function eliminarAlmacen(id: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuario no autenticado");

  // Mismo candado que tenía Traspasos: no se puede borrar un almacén
  // que todavía tiene stock adentro — hay que traspasarlo primero, o
  // el stock quedaría huérfano (ligado a un ubicacion_id que ya no
  // existe, aunque la fila en stock_ubicaciones no se borre por el
  // "on delete cascade" — el número simplemente desaparecería).
  const { data: filasConStock, error: errorConsulta } = await supabase
    .from("stock_ubicaciones")
    .select("id")
    .eq("ubicacion_id", id)
    .gt("stock", 0)
    .limit(1);

  if (errorConsulta) throw errorConsulta;

  if (filasConStock && filasConStock.length > 0) {
    throw new Error("ALMACEN_CON_STOCK");
  }

  const { data, error } = await supabase.from("ubicaciones").delete().eq("id", id).select("id");

  if (error) throw error;

  if (!data || data.length === 0) {
    throw new Error("NO_SE_PUDO_ELIMINAR");
  }
}
