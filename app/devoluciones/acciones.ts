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
      .select("id, nombre, stock, precio_venta, categoria")
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
    throw new Error("CANTIDAD_INVALIDA");
  }

  if (!Number.isFinite(montoReembolsado) || montoReembolsado < 0) {
    throw new Error("MONTO_INVALIDO");
  }

  const negocioId = await obtenerNegocioId(user.id);

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
      throw new Error("NO_SE_REPUSO_STOCK");
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
  let negocioId: string | null = null;
  let stockRevertido = false;

  if (devolucion.repuso_stock && devolucion.producto_id) {
    negocioId = await obtenerNegocioId(user.id);
    const exito = await ajustarStockConCas(devolucion.producto_id, negocioId, -devolucion.cantidad, {
      minimoCero: true,
    });

    if (!exito) {
      throw new Error("STOCK_CAMBIO");
    }

    stockRevertido = true;
  }

  try {
    // Mismo motivo que en Compras: sin .select("id"), un DELETE que no
    // borra nada (otro dispositivo se adelantó, o RLS lo rechaza sin
    // error) se daría por bueno con el stock ya revertido, y cada
    // reintento volvería a revertirlo.
    const { data: eliminada, error } = await supabase
      .from("devoluciones")
      .delete()
      .eq("id", devolucion.id)
      .select("id");

    if (error) {
      throw error;
    }

    if (!eliminada || eliminada.length === 0) {
      throw new Error("YA_ELIMINADA");
    }
  } catch (error) {
    // Si el borrado falla justo después de haber revertido el stock, hay
    // que deshacer esa reversión — si no, la devolución sigue existiendo
    // y un reintento del usuario la revertiría una segunda vez.
    if (stockRevertido && devolucion.producto_id && negocioId) {
      const deshecho = await ajustarStockConCas(devolucion.producto_id, negocioId, devolucion.cantidad);
      if (!deshecho) {
        console.error(
          "No se pudo deshacer la reversión de stock tras un fallo al eliminar la devolución. Revisar manualmente producto_id=" +
            devolucion.producto_id
        );
      }
    }
    throw error;
  }
}
