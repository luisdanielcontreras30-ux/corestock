import { supabase } from "../../../lib/supabase";

export interface ProductoPublico {
  id: number;
  nombre: string;
  precio: number;
  imagen: string | null;
  categoria: string;
  descripcion: string | null;
}

interface FilaCatalogoPublico {
  nombre_negocio: string;
  logo_url: string | null;
  color_principal: string | null;
  telefono: string | null;
  producto_id: number | null;
  producto_nombre: string | null;
  producto_precio: number | null;
  producto_imagen: string | null;
  producto_categoria: string | null;
  producto_descripcion: string | null;
}

export async function obtenerCatalogoPublico(userId: string) {
  const { data, error } = await supabase.rpc("obtener_catalogo_publico", {
    p_user_id: userId,
  });

  if (error) throw error;

  const filas = (data ?? []) as FilaCatalogoPublico[];

  if (filas.length === 0) {
    return { encontrado: false as const };
  }

  const [primera] = filas;

  const productos: ProductoPublico[] = filas
    .filter((fila) => fila.producto_id !== null)
    .map((fila) => ({
      id: fila.producto_id as number,
      nombre: fila.producto_nombre ?? "",
      precio: fila.producto_precio ?? 0,
      imagen: fila.producto_imagen,
      categoria: fila.producto_categoria?.trim() || "",
      descripcion: fila.producto_descripcion?.trim() || null,
    }));

  return {
    encontrado: true as const,
    nombreNegocio: primera.nombre_negocio,
    logoUrl: primera.logo_url,
    colorPrincipal: primera.color_principal ?? "#5945e4",
    telefono: primera.telefono,
    productos,
  };
}
