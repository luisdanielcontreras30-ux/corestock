import { supabase } from "../../lib/supabase";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { Cliente, ClienteConResumen, CompraCliente } from "./types";

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
      .select("cliente_id, total, cobrado")
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

    // Una venta a préstamo sin cobrar todavía es una cuenta por cobrar
    // pendiente (ver Cuentas por Cobrar), no dinero que el cliente ya
    // gastó — sumarla aquí infla "total gastado" con dinero que el
    // negocio no ha recibido.
    if (venta.cobrado) {
      actual.totalGastado += Number(venta.total);
    }

    resumenPorCliente.set(venta.cliente_id, actual);
  }

  const clientesConResumen: ClienteConResumen[] = ((clientes ?? []) as Cliente[]).map(
    (cliente) => ({
      ...cliente,
      compras: resumenPorCliente.get(cliente.id)?.compras ?? 0,
      totalGastado: resumenPorCliente.get(cliente.id)?.totalGastado ?? 0,
    })
  );

  return { clientes: clientesConResumen };
}

export async function crearCliente(
  nombre: string,
  telefono: string,
  correo: string,
  notas: string,
  // Categoría. Va aparte y solo con lo que de verdad se llenó: en una
  // base sin la migración corrida, la petición no menciona esa columna
  // y el alta sigue funcionando.
  extras: Partial<Cliente> = {}
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
  if (!nombre.trim()) {
    throw new Error("Falta el nombre del cliente.");
  }

  const { error } = await supabase.from("clientes").insert({
    nombre: nombre.trim(),
    telefono: telefono.trim() || null,
    correo: correo.trim() || null,
    notas: notas.trim() || null,
    user_id: negocioId,
    ...extras,
  });

  if (error) {
    throw error;
  }
}

export async function actualizarCliente(id: number, cambios: Partial<Cliente>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  if (cambios.nombre !== undefined && !cambios.nombre.trim()) {
    throw new Error("Falta el nombre del cliente.");
  }

  const { data, error } = await supabase
    .from("clientes")
    .update(cambios)
    .eq("id", id)
    .select("id");

  if (error) {
    throw error;
  }

  // Sin filas afectadas = RLS lo rechazó en silencio (cliente de otro
  // negocio, o un miembro sin permiso) — sin esto la pantalla cerraba
  // el formulario como si se hubiera guardado, aunque en la base no
  // cambió nada. Mismo cuidado que ya tiene regenerarTokenPortal más
  // abajo en este archivo.
  if (!data || data.length === 0) {
    throw new Error("NO_SE_PUDO_ACTUALIZAR");
  }
}

export async function eliminarCliente(id: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const { data, error } = await supabase
    .from("clientes")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error("NO_SE_PUDO_ELIMINAR");
  }
}

// Cambia el token del enlace del Portal de Clientes por uno nuevo. El
// enlace anterior deja de funcionar al instante: es la única forma de
// revocar un link que se filtró (se reenvió a quien no debía, quedó en
// un chat de grupo, etc.), porque el portal no pide contraseña — quien
// tiene el enlace ve el historial de compras de esa persona.
//
// El uuid se genera aquí y no en la base para poder devolverlo y que la
// pantalla muestre el enlace nuevo sin recargar. La columna tiene
// índice único, así que una colisión (imposible en la práctica con
// uuid v4) fallaría con error en vez de pisar el token de otro cliente.
export async function regenerarTokenPortal(id: number): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const nuevoToken = crypto.randomUUID();

  const { data, error } = await supabase
    .from("clientes")
    .update({ token: nuevoToken })
    .eq("id", id)
    .select("token");

  if (error) {
    throw error;
  }

  // Sin filas actualizadas = RLS lo rechazó (cliente de otro negocio, o
  // un miembro sin acceso). Se avisa en vez de devolver un token nuevo
  // que en realidad nunca se guardó.
  if (!data || data.length === 0) {
    throw new Error("NO_SE_PUDO_REGENERAR");
  }

  return data[0].token as string;
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
