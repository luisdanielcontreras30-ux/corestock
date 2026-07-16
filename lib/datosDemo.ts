// Catálogo de datos de muestra para la cuenta demo (ver lib/sembrarDemo.ts).
// Son datos ficticios pensados para que la cuenta demo se vea "viva" desde
// el primer inicio de sesión: varias categorías con ~10 productos cada
// una, clientes, proveedores, historial de ventas/compras y promociones.

// [nombre, costo, precio_venta]
export const PRODUCTOS_DEMO: Record<string, [string, number, number][]> = {
  Bebidas: [
    ["Agua Embotellada 600ml", 6, 12],
    ["Refresco de Cola 600ml", 9, 18],
    ["Refresco de Naranja 600ml", 9, 17.5],
    ["Jugo de Manzana 1L", 14, 26],
    ["Agua Mineral 355ml", 7, 14],
    ["Té Helado 500ml", 10, 19],
    ["Bebida Energética 473ml", 16, 32],
    ["Café Soluble 200g", 45, 78],
    ["Agua de Coco 330ml", 15, 28],
    ["Refresco Sabor Toronja 600ml", 9, 18],
  ],
  Abarrotes: [
    ["Arroz 1kg", 18, 29],
    ["Frijol Negro 1kg", 22, 34],
    ["Aceite Vegetal 1L", 28, 42],
    ["Azúcar Estándar 1kg", 17, 26],
    ["Sal de Mesa 1kg", 8, 14],
    ["Harina de Trigo 1kg", 16, 25],
    ["Pasta para Sopa 500g", 12, 20],
    ["Atún en Lata 140g", 14, 23],
    ["Puré de Tomate 400g", 11, 18],
    ["Café Molido 250g", 48, 82],
  ],
  Lácteos: [
    ["Leche Entera 1L", 19, 27],
    ["Yogur Natural 1L", 24, 38],
    ["Queso Panela 400g", 42, 65],
    ["Queso Manchego 250g", 38, 58],
    ["Mantequilla 200g", 26, 40],
    ["Crema Ácida 250ml", 18, 29],
    ["Queso Oaxaca 400g", 44, 68],
    ["Leche Deslactosada 1L", 21, 30],
    ["Yogur Griego 150g", 15, 24],
    ["Queso Crema 190g", 22, 35],
  ],
  Limpieza: [
    ["Detergente en Polvo 1kg", 32, 52],
    ["Jabón para Trastes 750ml", 20, 32],
    ["Cloro 1L", 12, 20],
    ["Suavizante de Telas 1L", 24, 38],
    ["Papel Higiénico 4 Rollos", 30, 48],
    ["Servilletas 100pz", 10, 17],
    ["Fibra para Trastes", 6, 12],
    ["Limpiador Multiusos 1L", 22, 36],
    ["Bolsas para Basura 20pz", 18, 30],
    ["Desinfectante en Aerosol", 35, 56],
  ],
  Botanas: [
    ["Papas Fritas 150g", 14, 24],
    ["Cacahuates Japoneses 200g", 16, 27],
    ["Galletas Saladas 200g", 13, 22],
    ["Chicharrón de Cerdo 100g", 15, 26],
    ["Palomitas de Microondas", 12, 21],
    ["Totopos 200g", 14, 23],
    ["Chocolate en Barra 100g", 11, 19],
    ["Galletas Dulces 180g", 15, 25],
    ["Nueces Mixtas 150g", 28, 45],
    ["Barra de Cereal", 8, 15],
  ],
  "Higiene Personal": [
    ["Jabón de Baño", 8, 15],
    ["Shampoo 400ml", 32, 52],
    ["Pasta Dental 100ml", 24, 38],
    ["Crema Corporal 250ml", 30, 48],
    ["Desodorante en Barra", 26, 42],
    ["Cepillo Dental", 12, 22],
    ["Rastrillo Desechable", 9, 16],
    ["Enjuague Bucal 500ml", 28, 45],
    ["Acondicionador 400ml", 32, 52],
    ["Algodón 100g", 10, 18],
  ],
};

export const CLIENTES_DEMO: { nombre: string; telefono: string; correo: string }[] = [
  { nombre: "Roberto Sánchez", telefono: "55 1234 5678", correo: "roberto.sanchez@demo.com" },
  { nombre: "María Fernández", telefono: "55 2345 6789", correo: "maria.fernandez@demo.com" },
  { nombre: "Carlos Ramírez", telefono: "55 3456 7890", correo: "carlos.ramirez@demo.com" },
  { nombre: "Ana Torres", telefono: "55 4567 8901", correo: "ana.torres@demo.com" },
  { nombre: "Luis Herrera", telefono: "55 5678 9012", correo: "luis.herrera@demo.com" },
  { nombre: "Sofía Morales", telefono: "55 6789 0123", correo: "sofia.morales@demo.com" },
  { nombre: "Jorge Castillo", telefono: "55 7890 1234", correo: "jorge.castillo@demo.com" },
  { nombre: "Patricia Ruiz", telefono: "55 8901 2345", correo: "patricia.ruiz@demo.com" },
  { nombre: "Diego Flores", telefono: "55 9012 3456", correo: "diego.flores@demo.com" },
  { nombre: "Valentina Cruz", telefono: "55 0123 4567", correo: "valentina.cruz@demo.com" },
];

export const PROVEEDORES_DEMO: { nombre: string; telefono: string; correo: string }[] = [
  { nombre: "Distribuidora del Valle", telefono: "55 1111 2222", correo: "ventas@distribuidoravalle.demo" },
  { nombre: "Comercializadora Aurora", telefono: "55 3333 4444", correo: "contacto@aurora.demo" },
  { nombre: "Grupo Sarabia", telefono: "55 5555 6666", correo: "pedidos@gruposarabia.demo" },
  { nombre: "Abastos del Norte", telefono: "55 7777 8888", correo: "info@abastosnorte.demo" },
  { nombre: "Proveedora La Central", telefono: "55 9999 0000", correo: "ventas@lacentral.demo" },
];
