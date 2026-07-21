import { supabase } from "../../lib/supabase";
import { ajustarStockConCas } from "../../lib/stockCas";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { Producto, Devolucion } from "./types";

export async function cargarDatos() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      productos: [] as Producto[],
      devoluciones: [] as Devolucion[],
    };
  }

  // Las 2 consultas son independientes — se piden en paralelo en vez de
  // una tras otra para no sumar sus tiempos de ida y vuelta.
  const [
    { data: productos, error: errorProductos },
    { data: devoluciones, error: errorDevoluciones },
  ] = await Promise.all([
    supabase
      .from("productos")
      .select("id, nombre, stock, precio_venta")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("devoluciones")
      .select("*")
      .order("id", { ascending: false }),
  ]);

  if (errorProductos) throw errorProductos;
  if (errorDevoluciones) throw errorDevoluciones;

  return {
    productos: (productos ?? []) as Producto[],
    devoluciones: (devoluciones ?? []) as Devolucion[],
  };
}

export async function registrarDevolucion(
  producto: Producto,
  cantidad: number,
  montoReembolsado: number,
  motivo: string,
  reponerStock: boolean
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  // Repite del lado del servidor las mismas validaciones que ya hace
  // el formulario — esta acción es exportada y podría llamarse
  // directamente sin pasar por él.
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new Error("La cantidad debe ser mayor a 0");
  }

  if (!Number.isFinite(montoReembolsado) || montoReembolsado < 0) {
    throw new Error("El monto reembolsado no puede ser negativo");
  }

  const negocioId = await obtenerNegocioId();

  const { error } = await supabase.from("devoluciones").insert({
    user_id: negocioId,
    producto_id: producto.id,
    producto: producto.nombre,
    cantidad,
    monto_reembolsado: montoReembolsado,
    motivo: motivo.trim() || null,
    repuso_stock: reponerStock,
    fecha: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }

  if (reponerStock) {
    const exito = await ajustarStockConCas(producto.id, negocioId, cantidad);
    if (!exito) {
      // La devolución ya quedó registrada (el reembolso es un hecho
      // real) — solo no se pudo reponer el stock automáticamente por
      // una condición de carrera persistente. Se avisa para ajustarlo
      // a mano en vez de perder silenciosamente esas unidades.
      throw new Error(
        "La devolución se registró, pero no se pudo reponer el stock automáticamente. Ajústalo desde Ajustes de Stock."
      );
    }
  }
}

export async function eliminarDevolucion(devolucion: Devolucion) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  // Mismo orden que eliminarAjuste en Ajustes de Stock: primero se
  // revierte el stock (comprobando el resultado del CAS) y solo si eso
  // tuvo éxito se borra la fila. Así, si el CAS falla tras sus
  // reintentos, la devolución sigue existiendo y el usuario puede
  // reintentar en vez de perder silenciosamente el ajuste de stock.
  if (devolucion.repuso_stock && devolucion.producto_id) {
    const negocioId = await obtenerNegocioId();
    const exito = await ajustarStockConCas(devolucion.producto_id, negocioId, -devolucion.cantidad, {
      minimoCero: true,
    });

    if (!exito) {
      throw new Error(
        "El stock de este producto cambió mientras se procesaba el borrado. Intenta de nuevo."
      );
    }
  }

  const { error } = await supabase
    .from("devoluciones")
    .delete()
    .eq("id", devolucion.id);

  if (error) {
    throw error;
  }
}
