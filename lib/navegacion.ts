import {
  LayoutDashboard,
  BarChart3,
  Package,
  Bell,
  DollarSign,
  Settings,
  Sparkles,
  Truck,
  Users,
  ShoppingCart,
  FileText,
  Receipt,
  Files,
  Percent,
  ArrowRightLeft,
  SlidersHorizontal,
  Factory,
  Inbox,
  CalendarClock,
  UserCircle,
  BookOpen,
  Bot,
  MessageCircle,
  Landmark,
  PlayCircle,
  LucideIcon,
} from "lucide-react";

export interface ItemNav {
  claveNombre: string;
  href: string;
  Icono: LucideIcon;
  // Módulos que todavía no tienen funcionalidad real (ver
  // components/ProximamentePage.tsx) — se marcan en la navegación para
  // que el usuario no piense que ya funcionan antes de entrar.
  proximamente?: boolean;
}

export interface SeccionNav {
  claveTitulo: string;
  items: ItemNav[];
}

// Fuente única de la navegación de la app: la usan tanto el sidebar de
// escritorio como la página "/mas" en móvil.
export const SECCIONES_NAV: SeccionNav[] = [
  {
    claveTitulo: "sidebar.principal",
    items: [
      { claveNombre: "sidebar.dashboard", href: "/menu", Icono: LayoutDashboard },
      { claveNombre: "sidebar.graficas", href: "/graficas", Icono: BarChart3 },
      { claveNombre: "sidebar.asistente", href: "/asistente", Icono: Sparkles },
    ],
  },
  {
    claveTitulo: "sidebar.inventario",
    items: [
      { claveNombre: "sidebar.productos", href: "/productos", Icono: Package },
      { claveNombre: "sidebar.proveedores", href: "/proveedores", Icono: Truck },
      { claveNombre: "sidebar.alertas", href: "/alertas", Icono: Bell },
      { claveNombre: "sidebar.ajustes_stock", href: "/ajustes-stock", Icono: SlidersHorizontal },
      { claveNombre: "sidebar.traspasos", href: "/traspasos", Icono: ArrowRightLeft, proximamente: true },
      { claveNombre: "sidebar.fabricacion", href: "/fabricacion", Icono: Factory, proximamente: true },
    ],
  },
  {
    claveTitulo: "sidebar.operaciones",
    items: [
      { claveNombre: "sidebar.ventas", href: "/ventas", Icono: DollarSign },
      { claveNombre: "sidebar.clientes", href: "/clientes", Icono: Users },
      { claveNombre: "sidebar.compras", href: "/compras", Icono: ShoppingCart },
      { claveNombre: "sidebar.cotizaciones", href: "/cotizaciones", Icono: FileText },
      { claveNombre: "sidebar.facturas", href: "/facturas", Icono: Receipt },
      { claveNombre: "sidebar.facturas_globales", href: "/facturas-globales", Icono: Files, proximamente: true },
      { claveNombre: "sidebar.caja", href: "/caja", Icono: Inbox, proximamente: true },
      { claveNombre: "sidebar.cortes_historicos", href: "/cortes-historicos", Icono: CalendarClock, proximamente: true },
      { claveNombre: "sidebar.conciliaciones", href: "/conciliaciones", Icono: Landmark, proximamente: true },
    ],
  },
  {
    claveTitulo: "sidebar.marketing",
    items: [
      { claveNombre: "sidebar.promociones", href: "/promociones", Icono: Percent },
      { claveNombre: "sidebar.catalogo_linea", href: "/catalogo-linea", Icono: BookOpen, proximamente: true },
      { claveNombre: "sidebar.portal_clientes", href: "/portal-clientes", Icono: UserCircle, proximamente: true },
      { claveNombre: "sidebar.whatsapp", href: "/whatsapp", Icono: MessageCircle, proximamente: true },
    ],
  },
  {
    claveTitulo: "sidebar.sistema",
    items: [
      { claveNombre: "sidebar.configuracion", href: "/configuracion", Icono: Settings },
      { claveNombre: "sidebar.empleados_ia", href: "/empleados-ia", Icono: Bot, proximamente: true },
      { claveNombre: "sidebar.tutoriales", href: "/tutoriales", Icono: PlayCircle, proximamente: true },
    ],
  },
];

// Rutas que ya tienen su propio ícono fijo en la barra inferior móvil,
// así que no hace falta repetirlas en la página "Más".
export const RUTAS_EN_TABBAR_MOVIL = ["/menu", "/ventas", "/productos"];
