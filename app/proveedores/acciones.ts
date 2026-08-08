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
      .select("proveedor_id, total, fecha")
      .eq("user_id", userId)
      .not("proveedor_id", "is", null),
  ]);

  if (errorProveedores) throw errorProveedores;
  if (errorCompras) throw errorCompras;

  interface Acumulado {
    compras: number;
    totalGastado: number;
    ultimaCompra: string | null;
    gastoReciente: number;
    gastoAnterior: number;
  }

  const resumenPorProveedor = new Map<string, Acumulado>();

  // Dos ventanas de 30 días para poder decir si el gasto con cada
  // proveedor va subiendo o bajando. El corte se calcula UNA vez, no
  // dentro del bucle: si se leyera el reloj en cada vuelta, dos compras
  // de la misma lista podrían caer en ventanas distintas.
  const ahora = Date.now();
  const hace30 = new Date(ahora - 30 * 86400000).toISOString();
  const hace60 = new Date(ahora - 60 * 86400000).toISOString();

  for (const compra of compras ?? []) {
    if (compra.proveedor_id == null) continue;

    const actual = resumenPorProveedor.get(compra.proveedor_id) ?? {
      compras: 0,
      totalGastado: 0,
      ultimaCompra: null,
      gastoReciente: 0,
      gastoAnterior: 0,
    };

    // total es numeric en Postgres y PostgREST lo devuelve como texto:
    // sumar sin convertir concatenaría cadenas en vez de sumar.
    const monto = Number(compra.total) || 0;
    const fecha = compra.fecha as string | null;

    actual.compras += 1;
    actual.totalGastado += monto;

    if (fecha) {
      if (!actual.ultimaCompra || fecha > actual.ultimaCompra) actual.ultimaCompra = fecha;
      if (fecha >= hace30) actual.gastoReciente += monto;
      else if (fecha >= hace60) actual.gastoAnterior += monto;
    }

    resumenPorProveedor.set(compra.proveedor_id, actual);
  }

  return ((proveedores ?? []) as Proveedor[]).map((proveedor) => {
    const resumen = resumenPorProveedor.get(proveedor.id);
    return {
      ...proveedor,
      compras: resumen?.compras ?? 0,
      totalGastado: resumen?.totalGastado ?? 0,
      ultimaCompra: resumen?.ultimaCompra ?? null,
      gastoReciente: resumen?.gastoReciente ?? 0,
      gastoAnterior: resumen?.gastoAnterior ?? 0,
    };
  });
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


// Los rangos se repiten aquí a propósito, igual que la validación del
// nombre: estas acciones son exportadas y podrían llamarse sin pasar por
// la pantalla. La base también los restringe
// (supabase_proveedores_scorecard.sql), pero su error llega como un
// mensaje de Postgres que nadie puede leer — esto lo convierte en un
// sentinel que la pantalla sabe traducir.
function validarPanel(cambios: Partial<Proveedor>) {
  const calificacion = cambios.calificacion;
  if (
    calificacion !== undefined &&
    calificacion !== null &&
    (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5)
  ) {
    throw new Error("CALIFICACION_INVALIDA");
  }

  const dias = cambios.dias_entrega;
  if (
    dias !== undefined &&
    dias !== null &&
    (!Number.isInteger(dias) || dias < 0 || dias > 365)
  ) {
    throw new Error("DIAS_INVALIDOS");
  }
}

export async function crearProveedor(
  userId: string,
  nombre: string,
  telefono: string,
  correo: string,
  notas: string,
  // Categoría, calificación y días de entrega. Van aparte y solo con lo
  // que de verdad se llenó: en una base sin la migración corrida, la
  // petición no menciona esas columnas y el alta sigue funcionando.
  extras: Partial<Proveedor> = {}
): Promise<void> {
  // El formulario (page.tsx) ya valida esto, pero se repite aquí porque
  // esta acción es exportada y podría llamarse directamente sin pasar
  // por él — mismo patrón que Compras/Devoluciones/Conciliaciones.
  if (!nombre.trim()) {
    throw new Error("Falta el nombre del proveedor.");
  }

  validarPanel(extras);

  const { error } = await supabase.from("proveedores").insert({
    user_id: userId,
    nombre: nombre.trim(),
    telefono: telefono.trim() || null,
    correo: correo.trim() || null,
    notas: notas.trim() || null,
    activo: true,
    ...extras,
  });

  if (error) throw error;
}

export async function actualizarProveedor(
  userId: string,
  id: string,
  cambios: Partial<Proveedor>
): Promise<void> {
  if (cambios.nombre !== undefined && !cambios.nombre.trim()) {
    throw new Error("Falta el nombre del proveedor.");
  }

  validarPanel(cambios);

  const { data, error } = await supabase
    .from("proveedores")
    .update(cambios)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) throw error;

  // Sin filas afectadas = RLS lo rechazó en silencio (proveedor de
  // otro negocio) — sin esto se mostraba como guardado aunque en la
  // base no cambió nada.
  if (!data || data.length === 0) {
    throw new Error("NO_SE_PUDO_ACTUALIZAR");
  }
}

export async function eliminarProveedor(
  userId: string,
  id: string
): Promise<void> {
  const { data, error } = await supabase
    .from("proveedores")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) throw error;

  if (!data || data.length === 0) {
    throw new Error("NO_SE_PUDO_ELIMINAR");
  }
}
