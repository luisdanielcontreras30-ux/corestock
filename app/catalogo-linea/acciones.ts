import { supabase } from "../../lib/supabase";
import { obtenerNegocioId } from "../../lib/negocioActual";
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

  // El enlace público del catálogo se arma con este id — tiene que ser
  // el del NEGOCIO (la ruta pública /catalogo/[userId] está scopeada
  // por ese id), no el auth.uid() propio de quien llama: para un
  // miembro del equipo son distintos.
  const negocioId = await obtenerNegocioId(user.id);

  // Las 2 consultas son independientes — se piden en paralelo en vez de
  // una tras otra para no sumar sus tiempos de ida y vuelta.
  const [
    { data: empresa, error: errorEmpresa },
    { data: productos, error: errorProductos },
  ] = await Promise.all([
    supabase
      .from("empresa_config")
      .select("catalogo_activo")
      .maybeSingle(),
    supabase
      .from("productos")
      .select("id, nombre, precio_venta, imagen")
      .eq("activo", true)
      .order("nombre"),
  ]);

  if (errorEmpresa) throw errorEmpresa;
  if (errorProductos) throw errorProductos;

  return {
    activo: empresa?.catalogo_activo ?? false,
    empresaConfigurada: empresa !== null,
    productos: (productos ?? []) as ProductoCatalogo[],
    userId: negocioId,
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

  const negocioId = await obtenerNegocioId(user.id);

  const { data, error } = await supabase
    .from("empresa_config")
    .update({ catalogo_activo: activo })
    .eq("user_id", negocioId)
    .select("user_id");

  if (error) throw error;

  if (!data || data.length === 0) {
    // Sentinel sin traducir a propósito — este archivo no tiene acceso
    // al idioma activo. page.tsx lo reconoce y muestra el mensaje ya
    // traducido (catalogo_linea.msg_falta_empresa); si no lo reconoce,
    // muestra su propio mensaje genérico.
    throw new Error("EMPRESA_NO_CONFIGURADA");
  }
}
