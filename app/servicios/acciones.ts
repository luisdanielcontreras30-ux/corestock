import { supabase } from "../../lib/supabase";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { ClienteOpcion, EstadoTrabajo, Trabajo } from "./types";

export async function cargarDatos() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      clientes: [] as ClienteOpcion[],
      trabajos: [] as Trabajo[],
    };
  }

  // Las 2 consultas son independientes — se piden en paralelo en vez de
  // una tras otra para no sumar sus tiempos de ida y vuelta.
  const [
    { data: clientes, error: errorClientes },
    { data: trabajos, error: errorTrabajos },
  ] = await Promise.all([
    supabase.from("clientes").select("id, nombre").order("nombre"),
    supabase.from("servicios_trabajos").select("*").order("fecha", { ascending: false }),
  ]);

  if (errorClientes) throw errorClientes;
  if (errorTrabajos) throw errorTrabajos;

  return {
    clientes: (clientes ?? []) as ClienteOpcion[],
    trabajos: (trabajos ?? []) as Trabajo[],
  };
}

export async function registrarTrabajo(
  clienteId: number | null,
  clienteNombre: string,
  servicio: string,
  fecha: string,
  precio: number,
  notas: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const negocioId = await obtenerNegocioId(user.id);

  // El formulario (page.tsx) ya valida esto, pero se repite aquí porque
  // esta acción es exportada y podría llamarse directamente sin pasar
  // por él — mismo patrón que Compras/Devoluciones/Conciliaciones.
  if (!clienteNombre.trim()) {
    throw new Error("FALTA_CLIENTE");
  }
  if (!servicio.trim()) {
    throw new Error("FALTA_SERVICIO");
  }
  if (!Number.isFinite(precio) || precio < 0) {
    throw new Error("PRECIO_INVALIDO");
  }

  const { error } = await supabase.from("servicios_trabajos").insert({
    user_id: negocioId,
    cliente_id: clienteId,
    cliente_nombre: clienteNombre.trim(),
    servicio: servicio.trim(),
    fecha,
    precio,
    notas: notas.trim() || null,
  });

  if (error) {
    throw error;
  }
}

export async function cambiarEstadoTrabajo(id: number, estado: EstadoTrabajo) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { error } = await supabase
    .from("servicios_trabajos")
    .update({ estado })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function eliminarTrabajo(id: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { error } = await supabase
    .from("servicios_trabajos")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}
