import { supabase } from "./supabase";
import { TipoNegocio } from "./tiposNegocio";

// Ejemplos con los que arranca una cuenta al elegir su tipo de negocio
// (ver TipoNegocioProvider.elegirTipoNegocio) — para que la pantalla no
// se sienta vacía y la persona entienda de inmediato qué va en
// Productos o en Servicios. Nombres/precios son solo un punto de
// partida en pesos mexicanos; se editan o borran como cualquier otro
// registro.

interface ProductoSemilla {
  nombre: string;
  categoria: string;
  costo: number;
  precio_venta: number;
  stock: number;
  stock_minimo: number;
}

interface ServicioSemilla {
  nombre: string;
  precio: number;
}

const PRODUCTOS_SEMILLA: Partial<Record<TipoNegocio, ProductoSemilla[]>> = {
  abarrotes: [
    { nombre: "Refresco de cola 600ml", categoria: "Bebidas", costo: 10, precio_venta: 18, stock: 40, stock_minimo: 10 },
    { nombre: "Agua purificada 1L", categoria: "Bebidas", costo: 6, precio_venta: 12, stock: 50, stock_minimo: 10 },
    { nombre: "Galletas surtidas", categoria: "Botanas", costo: 12, precio_venta: 20, stock: 30, stock_minimo: 8 },
    { nombre: "Leche entera 1L", categoria: "Lácteos", costo: 18, precio_venta: 26, stock: 25, stock_minimo: 8 },
    { nombre: "Papel higiénico 4 rollos", categoria: "Limpieza", costo: 25, precio_venta: 38, stock: 20, stock_minimo: 5 },
    { nombre: "Detergente en polvo 1kg", categoria: "Limpieza", costo: 30, precio_venta: 45, stock: 15, stock_minimo: 5 },
  ],
  ropa: [
    { nombre: "Playera básica de algodón", categoria: "Playeras", costo: 80, precio_venta: 150, stock: 20, stock_minimo: 5 },
    { nombre: "Pantalón de mezclilla", categoria: "Pantalones", costo: 220, precio_venta: 400, stock: 15, stock_minimo: 4 },
    { nombre: "Sudadera con capucha", categoria: "Sudaderas", costo: 180, precio_venta: 320, stock: 12, stock_minimo: 4 },
    { nombre: "Vestido casual", categoria: "Vestidos", costo: 250, precio_venta: 450, stock: 10, stock_minimo: 3 },
    { nombre: "Tenis deportivos", categoria: "Calzado", costo: 300, precio_venta: 550, stock: 10, stock_minimo: 3 },
  ],
  restaurante: [
    { nombre: "Hamburguesa clásica", categoria: "Platillos", costo: 35, precio_venta: 75, stock: 999, stock_minimo: 0 },
    { nombre: "Ensalada César", categoria: "Platillos", costo: 30, precio_venta: 65, stock: 999, stock_minimo: 0 },
    { nombre: "Papas fritas", categoria: "Complementos", costo: 15, precio_venta: 35, stock: 999, stock_minimo: 0 },
    { nombre: "Refresco 355ml", categoria: "Bebidas", costo: 8, precio_venta: 20, stock: 999, stock_minimo: 0 },
    { nombre: "Café americano", categoria: "Bebidas", costo: 5, precio_venta: 25, stock: 999, stock_minimo: 0 },
  ],
  lavado_autos: [
    { nombre: "Cera para autos", categoria: "Accesorios", costo: 60, precio_venta: 120, stock: 15, stock_minimo: 4 },
    { nombre: "Aromatizante para auto", categoria: "Accesorios", costo: 15, precio_venta: 35, stock: 20, stock_minimo: 5 },
  ],
};

const SERVICIOS_SEMILLA: Partial<Record<TipoNegocio, ServicioSemilla[]>> = {
  lavado_autos: [
    { nombre: "Lavado básico", precio: 80 },
    { nombre: "Lavado premium", precio: 150 },
    { nombre: "Encerado", precio: 200 },
    { nombre: "Aspirado de interiores", precio: 60 },
  ],
  taller_servicios: [
    { nombre: "Diagnóstico general", precio: 150 },
    { nombre: "Cambio de aceite", precio: 350 },
    { nombre: "Revisión de frenos", precio: 280 },
    { nombre: "Alineación y balanceo", precio: 400 },
  ],
};

// Se llama justo después de elegir/cambiar el tipo de negocio. Nunca
// pisa datos reales: cada tabla solo se siembra si la cuenta todavía
// la tiene vacía, así que en cuanto la persona agrega su primer
// producto o servicio de verdad, esto deja de tocar esa tabla — sin
// importar cuántas veces cambie de tipo de negocio después.
export async function sembrarEjemplosTipoNegocio(negocioId: string, tipo: TipoNegocio): Promise<void> {
  const productos = PRODUCTOS_SEMILLA[tipo];
  if (productos && productos.length > 0) {
    const { count, error } = await supabase
      .from("productos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", negocioId);

    if (!error && !count) {
      const { error: errorInsert } = await supabase.from("productos").insert(
        productos.map((p) => ({
          ...p,
          user_id: negocioId,
          activo: true,
          imagen: null,
          descripcion: null,
        }))
      );
      if (errorInsert) console.error("No se pudieron sembrar productos de ejemplo:", errorInsert);
    }
  }

  const servicios = SERVICIOS_SEMILLA[tipo];
  if (servicios && servicios.length > 0) {
    const { count, error } = await supabase
      .from("servicios_plantillas")
      .select("id", { count: "exact", head: true })
      .eq("user_id", negocioId);

    if (!error && !count) {
      const { error: errorInsert } = await supabase
        .from("servicios_plantillas")
        .insert(servicios.map((s) => ({ ...s, user_id: negocioId })));
      if (errorInsert) console.error("No se pudieron sembrar servicios de ejemplo:", errorInsert);
    }
  }
}
