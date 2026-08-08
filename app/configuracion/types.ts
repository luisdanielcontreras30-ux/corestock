export type Rol = "administrador" | "gerente" | "cajero" | "almacen";

export const ROLES: { valor: Rol; clave: string }[] = [
  { valor: "administrador", clave: "rol.administrador" },
  { valor: "gerente", clave: "rol.gerente" },
  { valor: "cajero", clave: "rol.cajero" },
  { valor: "almacen", clave: "rol.almacen" },
];

export type Permiso =
  | "ver_ventas"
  | "registrar_ventas"
  | "editar_ventas"
  | "eliminar_ventas"
  | "ver_ganancias"
  | "exportar_datos"
  | "ver_inventario"
  | "gestionar_inventario"
  | "ver_caja"
  | "configuracion";

export const PERMISOS: { valor: Permiso; clave: string }[] = [
  { valor: "ver_ventas", clave: "permiso.ver_ventas" },
  { valor: "registrar_ventas", clave: "permiso.registrar_ventas" },
  { valor: "editar_ventas", clave: "permiso.editar_ventas" },
  { valor: "eliminar_ventas", clave: "permiso.eliminar_ventas" },
  { valor: "ver_ganancias", clave: "permiso.ver_ganancias" },
  { valor: "exportar_datos", clave: "permiso.exportar_datos" },
  { valor: "ver_inventario", clave: "permiso.ver_inventario" },
  { valor: "gestionar_inventario", clave: "permiso.gestionar_inventario" },
  { valor: "ver_caja", clave: "permiso.ver_caja" },
  { valor: "configuracion", clave: "permiso.configuracion" },
];

// Permisos sugeridos por defecto al elegir un rol (el usuario puede
// personalizarlos después).
export const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  administrador: PERMISOS.map((p) => p.valor),
  gerente: [
    "ver_ventas",
    "registrar_ventas",
    "editar_ventas",
    "ver_ganancias",
    "exportar_datos",
    "ver_inventario",
    "gestionar_inventario",
    "ver_caja",
  ],
  cajero: ["ver_ventas", "registrar_ventas", "ver_caja"],
  almacen: ["ver_inventario", "gestionar_inventario", "ver_ventas"],
};

export interface Miembro {
  id: string;
  nombre: string;
  correo: string | null;
  rol: Rol;
  permisos: Permiso[];
  activo: boolean;
  tiene_contrasena: boolean;
}

export interface EmpresaConfig {
  id?: string;
  nombre_negocio: string;
  logo_url: string | null;
  direccion: string;
  telefono: string;
  correo: string;
  rfc: string;
  moneda: string;
  zona_horaria: string;
  idioma: string;
  color_principal: string;
  // Apariencia del catálogo público. Todas opcionales: llegan con
  // supabase_catalogo_apariencia.sql y la consulta usa select("*"), así
  // que sin la migración simplemente no vienen y la pantalla sigue
  // funcionando con el color principal de siempre.
  catalogo_color_fondo?: string | null;
  catalogo_color_producto?: string | null;
  catalogo_color_borde?: string | null;
  catalogo_color_titulo?: string | null;
  catalogo_color_precio?: string | null;
  catalogo_color_boton?: string | null;
  catalogo_colores_categoria?: Record<string, string> | null;
  // Ver supabase_limpieza_ventas.sql — opcional porque select("*") no
  // trae la columna si esa migración todavía no corrió.
  limpieza_ventas_activa?: boolean;
}

export const EMPRESA_VACIA: EmpresaConfig = {
  nombre_negocio: "",
  logo_url: null,
  direccion: "",
  telefono: "",
  correo: "",
  rfc: "",
  moneda: "MXN",
  zona_horaria: "America/Mexico_City",
  idioma: "es",
  color_principal: "#5945e4",
};
