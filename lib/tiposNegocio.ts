import {
  ShoppingBasket,
  Car,
  Shirt,
  UtensilsCrossed,
  Wrench,
  Sparkles,
  LucideIcon,
} from "lucide-react";
import { SECCIONES_NAV } from "./navegacion";

// Tipos de negocio que CoreStock reconoce para recomendar qué módulos
// mostrar de entrada (ver RUTAS_RECOMENDADAS más abajo). Agregar uno
// nuevo es solo: una entrada aquí + su set de rutas recomendadas — no
// hace falta tocar Sidebar, Configuración ni el flujo de registro.
export type TipoNegocio =
  | "abarrotes"
  | "lavado_autos"
  | "ropa"
  | "restaurante"
  | "taller_servicios"
  | "otro";

export interface OpcionTipoNegocio {
  id: TipoNegocio;
  claveNombre: string;
  Icono: LucideIcon;
}

export const TIPOS_NEGOCIO: OpcionTipoNegocio[] = [
  { id: "abarrotes", claveNombre: "tipo_negocio.abarrotes", Icono: ShoppingBasket },
  { id: "lavado_autos", claveNombre: "tipo_negocio.lavado_autos", Icono: Car },
  { id: "ropa", claveNombre: "tipo_negocio.ropa", Icono: Shirt },
  { id: "restaurante", claveNombre: "tipo_negocio.restaurante", Icono: UtensilsCrossed },
  { id: "taller_servicios", claveNombre: "tipo_negocio.taller_servicios", Icono: Wrench },
  { id: "otro", claveNombre: "tipo_negocio.otro", Icono: Sparkles },
];

// Rutas que se activan solas al elegir un tipo de negocio (semilla
// inicial de empresa_config.rutas_activas) — un punto de partida, no
// un límite: la persona sigue pudiendo prender/apagar cualquiera desde
// Configuración > Personalización, y ninguna ruta deja de funcionar
// por no estar aquí. "otro" no tiene entrada a propósito: sin
// suficiente certeza del negocio no hay nada razonable que recomendar,
// así que se deja el menú completo (rutas_activas en null).
//
// /menu y /configuracion se incluyen siempre: son navegación, no un
// módulo de negocio, y ocultarlos sería una mala sorpresa.
export const RUTAS_RECOMENDADAS: Partial<Record<TipoNegocio, string[]>> = {
  abarrotes: [
    "/menu",
    "/ventas-rapidas",
    "/productos",
    "/caja",
    "/compras",
    "/proveedores",
    "/alertas",
    "/clientes",
    "/configuracion",
  ],
  lavado_autos: [
    "/menu",
    "/clientes",
    "/servicios",
    "/productos",
    "/ventas",
    "/caja",
    "/cotizaciones",
    "/configuracion",
  ],
  ropa: [
    "/menu",
    "/productos",
    "/clientes",
    "/ventas",
    "/promociones",
    "/catalogo-linea",
    "/configuracion",
  ],
  restaurante: [
    "/menu",
    "/ventas-rapidas",
    "/productos",
    "/caja",
    "/clientes",
    "/compras",
    "/configuracion",
  ],
  taller_servicios: [
    "/menu",
    "/servicios",
    "/clientes",
    "/cotizaciones",
    "/caja",
    "/configuracion",
  ],
};

// Rutas que la personalización nunca filtra, aunque no estén en la
// lista recomendada del tipo de negocio: son navegación / cuenta, no
// un módulo del negocio en sí (mismo criterio que ya usa RUTAS_EASY en
// lib/navegacion.ts para estas mismas rutas).
export const RUTAS_SIEMPRE_VISIBLES = [
  "/menu",
  "/graficas",
  "/asistente",
  "/configuracion",
  "/suscripcion",
  "/tutoriales",
];

// Módulos que sí puede elegir la personalización (todo lo de
// SECCIONES_NAV menos lo siempre-visible y lo que todavía no tiene
// funcionalidad real) — fuente única para: la grilla de checkboxes de
// Configuración > Personalización, Y el catálogo que se le manda a la
// IA en /api/ia/recomendar-modulos para que elija de una lista
// cerrada y real en vez de inventar rutas que no existen.
export const MODULOS_PERSONALIZABLES = SECCIONES_NAV.flatMap((s) => s.items).filter(
  (item) => !RUTAS_SIEMPRE_VISIBLES.includes(item.href) && !item.proximamente
);
