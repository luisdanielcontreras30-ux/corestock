export interface Guia {
  id: string;
  // Coincide con claveTitulo de SECCIONES_NAV, para agrupar por sección.
  categoria: string;
  tituloClave: string;
  descripcionClave: string;
  pasosClaves: string[];
}

export const GUIAS: Guia[] = [
  {
    id: "primeros-pasos",
    categoria: "sidebar.principal",
    tituloClave: "tutoriales.guia_primeros_pasos_titulo",
    descripcionClave: "tutoriales.guia_primeros_pasos_desc",
    pasosClaves: [
      "tutoriales.primeros_pasos_1",
      "tutoriales.primeros_pasos_2",
      "tutoriales.primeros_pasos_3",
      "tutoriales.primeros_pasos_4",
    ],
  },
  {
    id: "productos",
    categoria: "sidebar.inventario",
    tituloClave: "sidebar.productos",
    descripcionClave: "tutoriales.guia_productos_desc",
    pasosClaves: [
      "tutoriales.productos_1",
      "tutoriales.productos_2",
      "tutoriales.productos_3",
      "tutoriales.productos_4",
    ],
  },
  {
    id: "ajustes-stock",
    categoria: "sidebar.inventario",
    tituloClave: "sidebar.ajustes_stock",
    descripcionClave: "tutoriales.guia_ajustes_stock_desc",
    pasosClaves: [
      "tutoriales.ajustes_stock_1",
      "tutoriales.ajustes_stock_2",
      "tutoriales.ajustes_stock_3",
    ],
  },
  {
    id: "fabricacion",
    categoria: "sidebar.inventario",
    tituloClave: "sidebar.fabricacion",
    descripcionClave: "tutoriales.guia_fabricacion_desc",
    pasosClaves: [
      "tutoriales.fabricacion_1",
      "tutoriales.fabricacion_2",
      "tutoriales.fabricacion_3",
      "tutoriales.fabricacion_4",
    ],
  },
  {
    id: "ventas",
    categoria: "sidebar.operaciones",
    tituloClave: "sidebar.ventas",
    descripcionClave: "tutoriales.guia_ventas_desc",
    pasosClaves: [
      "tutoriales.ventas_1",
      "tutoriales.ventas_2",
      "tutoriales.ventas_3",
      "tutoriales.ventas_4",
    ],
  },
  {
    id: "compras",
    categoria: "sidebar.operaciones",
    tituloClave: "sidebar.compras",
    descripcionClave: "tutoriales.guia_compras_desc",
    pasosClaves: [
      "tutoriales.compras_1",
      "tutoriales.compras_2",
      "tutoriales.compras_3",
    ],
  },
  {
    id: "cotizaciones",
    categoria: "sidebar.operaciones",
    tituloClave: "sidebar.cotizaciones",
    descripcionClave: "tutoriales.guia_cotizaciones_desc",
    pasosClaves: [
      "tutoriales.cotizaciones_1",
      "tutoriales.cotizaciones_2",
      "tutoriales.cotizaciones_3",
    ],
  },
  {
    id: "caja",
    categoria: "sidebar.operaciones",
    tituloClave: "sidebar.caja",
    descripcionClave: "tutoriales.guia_caja_desc",
    pasosClaves: [
      "tutoriales.caja_1",
      "tutoriales.caja_2",
      "tutoriales.caja_3",
      "tutoriales.caja_4",
    ],
  },
  {
    id: "conciliaciones",
    categoria: "sidebar.operaciones",
    tituloClave: "sidebar.conciliaciones",
    descripcionClave: "tutoriales.guia_conciliaciones_desc",
    pasosClaves: [
      "tutoriales.conciliaciones_1",
      "tutoriales.conciliaciones_2",
      "tutoriales.conciliaciones_3",
    ],
  },
  {
    id: "promociones",
    categoria: "sidebar.marketing",
    tituloClave: "sidebar.promociones",
    descripcionClave: "tutoriales.guia_promociones_desc",
    pasosClaves: [
      "tutoriales.promociones_1",
      "tutoriales.promociones_2",
      "tutoriales.promociones_3",
    ],
  },
];
