import { supabase } from "../../lib/supabase";
import { obtenerNegocioId } from "../../lib/negocioActual";
import {
  ClienteConResumen,
  CompraCliente,
  DatosClienteForm,
} from "./types";

export async function cargarClientes() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { clientes: [] as ClienteConResumen[] };
  }

  // Las 2 consultas son independientes — se piden en paralelo en vez de
  // una tras otra para no sumar sus tiempos de ida y vuelta.
  const [
    { data: clientes, error: errorClientes },
    { data: ventas, error: errorVentas },
  ] = await Promise.all([
    supabase
      .from("clientes")
      .select("*")
      .order("nombre"),
    supabase
      .from("ventas")
      .select("cliente_id, total")
      .not("cliente_id", "is", null),
  ]);

  if (errorClientes) throw errorClientes;
  if (errorVentas) throw errorVentas;

  const resumenPorCliente = new Map<
    number,
    { compras: number; totalGastado: number }
  >();

  for (const venta of ventas ?? []) {
    if (venta.cliente_id == null) continue;

    const actual = resumenPorCliente.get(venta.cliente_id) ?? {
      compras: 0,
      totalGastado: 0,
    };

    actual.compras += 1;
    actual.totalGastado += Number(venta.total);

    resumenPorCliente.set(venta.cliente_id, actual);
  }

  const clientesConResumen: ClienteConResumen[] = (
    clientes ?? []
  ).map((cliente) => ({
    ...cliente,
    compras: resumenPorCliente.get(cliente.id)?.compras ?? 0,
    totalGastado:
      resumenPorCliente.get(cliente.id)?.totalGastado ?? 0,
  }));

  return { clientes: clientesConResumen };
}

export async function crearCliente(
  datos: DatosClienteForm
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const negocioId = await obtenerNegocioId(user.id);

  const { error } = await supabase.from("clientes").insert({
    nombre: datos.nombre.trim(),
    telefono: datos.telefono.trim() || null,
    correo: datos.correo.trim() || null,
    notas: datos.notas.trim() || null,
    user_id: negocioId,
  });

  if (error) {
    throw error;
  }
}

export async function actualizarCliente(
  id: number,
  datos: DatosClienteForm
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { error } = await supabase
    .from("clientes")
    .update({
      nombre: datos.nombre.trim(),
      telefono: datos.telefono.trim() || null,
      correo: datos.correo.trim() || null,
      notas: datos.notas.trim() || null,
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function eliminarCliente(id: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { error } = await supabase
    .from("clientes")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function cargarHistorialCompras(
  clienteId: number
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [] as CompraCliente[];
  }

  const { data, error } = await supabase
    .from("ventas")
    .select("id, fecha, producto, cantidad, precio, total")
    .eq("cliente_id", clienteId)
    .order("fecha", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as CompraCliente[];
}
