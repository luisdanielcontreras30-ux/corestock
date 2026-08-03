import { supabase } from "../../lib/supabase";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { ClienteOpcion, EstadoTrabajo, Trabajo, PlantillaServicio } from "./types";

export async function cargarDatos() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      clientes: [] as ClienteOpcion[],
      trabajos: [] as Trabajo[],
      plantillas: [] as PlantillaServicio[],
    };
  }

  // Las 3 consultas son independientes — se piden en paralelo en vez de
  // una tras otra para no sumar sus tiempos de ida y vuelta.
  //
  // servicios_plantillas es tolerante a que la tabla no exista todavía
  // (falta correr supabase_servicios_plantillas.sql): en ese caso la
  // pantalla de "servicios rápidos" simplemente no aparece, en vez de
  // que todo Servicios deje de cargar por eso.
  const [
    { data: clientes, error: errorClientes },
    { data: trabajos, error: errorTrabajos },
    { data: plantillas, error: errorPlantillas },
  ] = await Promise.all([
    supabase.from("clientes").select("id, nombre").order("nombre"),
    supabase.from("servicios_trabajos").select("*").order("fecha", { ascending: false }),
    supabase.from("servicios_plantillas").select("id, nombre, precio").order("nombre"),
  ]);

  if (errorClientes) throw errorClientes;
  if (errorTrabajos) throw errorTrabajos;
  if (errorPlantillas) console.error(errorPlantillas);

  return {
    clientes: (clientes ?? []) as ClienteOpcion[],
    trabajos: (trabajos ?? []) as Trabajo[],
    plantillas: (plantillas ?? []) as PlantillaServicio[],
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

  // fecha_cobro marca CUÁNDO se cobró de verdad, para que Dashboard y
  // Gráficas cuenten el ingreso el día correcto (ver
  // supabase_servicios_fecha_cobro.sql) — se pone al pasar a "cobrado"
  // y se limpia si el trabajo se regresa a otro estado, para no dejar
  // una fecha de cobro de una vez que ya no cuenta.
  const { error } = await supabase
    .from("servicios_trabajos")
    .update({ estado, fecha_cobro: estado === "cobrado" ? new Date().toISOString() : null })
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

// ----------------- SERVICIOS RÁPIDOS (plantillas) -----------------

export async function crearPlantilla(nombre: string, precio: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  if (!nombre.trim()) {
    throw new Error("FALTA_NOMBRE");
  }
  if (!Number.isFinite(precio) || precio <= 0) {
    throw new Error("PRECIO_INVALIDO");
  }

  const negocioId = await obtenerNegocioId(user.id);

  const { error } = await supabase.from("servicios_plantillas").insert({
    user_id: negocioId,
    nombre: nombre.trim(),
    precio,
  });

  if (error) {
    throw error;
  }
}

export async function eliminarPlantilla(id: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { error } = await supabase.from("servicios_plantillas").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

// Tocar una plantilla registra el trabajo y lo cobra en el mismo paso
// — a diferencia de registrarTrabajo() (que siempre entra como
// "pendiente"), aquí estado y fecha_cobro se ponen en "cobrado" desde
// el insert porque no tiene sentido pasar por pendiente/hecho para
// algo que, por definición, ya se hizo y se está cobrando ahora mismo.
export async function registrarServicioRapido(nombre: string, precio: number): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const negocioId = await obtenerNegocioId(user.id);
  const ahora = new Date().toISOString();

  const { error } = await supabase.from("servicios_trabajos").insert({
    user_id: negocioId,
    cliente_id: null,
    cliente_nombre: "",
    servicio: nombre,
    fecha: ahora,
    precio,
    estado: "cobrado",
    fecha_cobro: ahora,
    notas: null,
  });

  if (error) {
    throw error;
  }
}
