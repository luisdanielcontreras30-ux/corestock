import { supabase } from "../../lib/supabase";
import { ProductoCatalogo } from "./types";

export async function cargarEstadoCatalogo() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      activo: false,
      empresaConfigurada: false,
      productos: [] as ProductoCatalogo[],
      userId: null as string | null,
    };
  }

  const { data: empresa, error: errorEmpresa } = await supabase
    .from("empresa_config")
    .select("catalogo_activo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (errorEmpresa) throw errorEmpresa;

  const { data: productos, error: errorProductos } = await supabase
    .from("productos")
    .select("id, nombre, precio_venta, imagen")
    .eq("user_id", user.id)
    .eq("activo", true)
    .order("nombre");

  if (errorProductos) throw errorProductos;

  return {
    activo: empresa?.catalogo_activo ?? false,
    empresaConfigurada: empresa !== null,
    productos: (productos ?? []) as ProductoCatalogo[],
    userId: user.id,
  };
}

// Requiere que ya exista una fila en empresa_config (se crea al guardar
// en Configuración → Empresa) — así evitamos insertar una fila nueva
// con las demás columnas del negocio vacías.
export async function actualizarCatalogoActivo(activo: boolean) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuario no autenticado");

  const { data, error } = await supabase
    .from("empresa_config")
    .update({ catalogo_activo: activo })
    .eq("user_id", user.id)
    .select("user_id");

  if (error) throw error;

  if (!data || data.length === 0) {
    throw new Error("Primero guarda los datos de tu negocio en Configuración → Empresa.");
  }
}
