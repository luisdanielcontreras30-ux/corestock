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
  // Color de acento de este apartado — solo se usa en móvil (página
  // "Más" y la barra inferior), para que cada apartado se distinga a
  // simple vista. El sidebar de escritorio no lo usa a propósito.
  colorMovil: string;
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
      { claveNombre: "sidebar.dashboard", href: "/menu", Icono: LayoutDashboard, colorMovil: "#6366f1" },
      { claveNombre: "sidebar.graficas", href: "/graficas", Icono: BarChart3, colorMovil: "#06b6d4" },
      { claveNombre: "sidebar.asistente", href: "/asistente", Icono: Sparkles, colorMovil: "#a855f7" },
    ],
  },
  {
    claveTitulo: "sidebar.inventario",
    items: [
      { claveNombre: "sidebar.productos", href: "/productos", Icono: Package, colorMovil: "#22c55e" },
      { claveNombre: "sidebar.proveedores", href: "/proveedores", Icono: Truck, colorMovil: "#f59e0b" },
      { claveNombre: "sidebar.alertas", href: "/alertas", Icono: Bell, colorMovil: "#ef4444" },
      { claveNombre: "sidebar.ajustes_stock", href: "/ajustes-stock", Icono: SlidersHorizontal, colorMovil: "#0ea5e9" },
      { claveNombre: "sidebar.traspasos", href: "/traspasos", Icono: ArrowRightLeft, colorMovil: "#8b5cf6" },
      { claveNombre: "sidebar.fabricacion", href: "/fabricacion", Icono: Factory, colorMovil: "#ea580c" },
    ],
  },
  {
    claveTitulo: "sidebar.operaciones",
    items: [
      { claveNombre: "sidebar.ventas", href: "/ventas", Icono: DollarSign, colorMovil: "#10b981" },
      { claveNombre: "sidebar.clientes", href: "/clientes", Icono: Users, colorMovil: "#ec4899" },
      { claveNombre: "sidebar.compras", href: "/compras", Icono: ShoppingCart, colorMovil: "#14b8a6" },
      { claveNombre: "sidebar.cotizaciones", href: "/cotizaciones", Icono: FileText, colorMovil: "#3b82f6" },
      { claveNombre: "sidebar.facturas", href: "/facturas", Icono: Receipt, colorMovil: "#f43f5e" },
      { claveNombre: "sidebar.facturas_globales", href: "/facturas-globales", Icono: Files, colorMovil: "#d946ef" },
      { claveNombre: "sidebar.caja", href: "/caja", Icono: Inbox, colorMovil: "#84cc16" },
      { claveNombre: "sidebar.cortes_historicos", href: "/cortes-historicos", Icono: CalendarClock, colorMovil: "#eab308" },
      { claveNombre: "sidebar.conciliaciones", href: "/conciliaciones", Icono: Landmark, colorMovil: "#0d9488" },
    ],
  },
  {
    claveTitulo: "sidebar.marketing",
    items: [
      { claveNombre: "sidebar.promociones", href: "/promociones", Icono: Percent, colorMovil: "#f97316" },
      { claveNombre: "sidebar.catalogo_linea", href: "/catalogo-linea", Icono: BookOpen, colorMovil: "#7c3aed" },
      { claveNombre: "sidebar.portal_clientes", href: "/portal-clientes", Icono: UserCircle, colorMovil: "#db2777" },
      { claveNombre: "sidebar.whatsapp", href: "/whatsapp", Icono: MessageCircle, proximamente: true, colorMovil: "#25d366" },
    ],
  },
  {
    claveTitulo: "sidebar.sistema",
    items: [
      { claveNombre: "sidebar.configuracion", href: "/configuracion", Icono: Settings, colorMovil: "#64748b" },
      { claveNombre: "sidebar.empleados_ia", href: "/empleados-ia", Icono: Bot, proximamente: true, colorMovil: "#4f46e5" },
      { claveNombre: "sidebar.tutoriales", href: "/tutoriales", Icono: PlayCircle, colorMovil: "#0891b2" },
    ],
  },
];

// Rutas que ya tienen su propio ícono fijo en la barra inferior móvil,
// así que no hace falta repetirlas en la página "Más".
export const RUTAS_EN_TABBAR_MOVIL = ["/menu", "/ventas", "/productos"];
