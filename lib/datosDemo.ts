// Catálogo de datos de muestra para la cuenta demo (ver lib/sembrarDemo.ts).
// Son datos ficticios pensados para que la cuenta demo se vea "viva" desde
// el primer inicio de sesión: varias categorías con ~10 productos cada
// una, clientes, proveedores, historial de ventas/compras y promociones.

// [nombre, costo, precio_venta, palabra_clave_foto]
// La palabra clave (en inglés) se usa para pedir una foto real de un
// banco de imágenes por tema — ver getUrlFotoDemo() más abajo.
export const PRODUCTOS_DEMO: Record<string, [string, number, number, string][]> = {
  Bebidas: [
    ["Agua Embotellada 600ml", 6, 12, "water-bottle"],
    ["Refresco de Cola 600ml", 9, 18, "cola,soda"],
    ["Refresco de Naranja 600ml", 9, 17.5, "orange-soda"],
    ["Jugo de Manzana 1L", 14, 26, "apple-juice"],
    ["Agua Mineral 355ml", 7, 14, "sparkling-water"],
    ["Té Helado 500ml", 10, 19, "iced-tea"],
    ["Bebida Energética 473ml", 16, 32, "energy-drink"],
    ["Café Soluble 200g", 45, 78, "instant-coffee"],
    ["Agua de Coco 330ml", 15, 28, "coconut-water"],
    ["Refresco Sabor Toronja 600ml", 9, 18, "grapefruit-soda"],
  ],
  Abarrotes: [
    ["Arroz 1kg", 18, 29, "rice,bag"],
    ["Frijol Negro 1kg", 22, 34, "black-beans"],
    ["Aceite Vegetal 1L", 28, 42, "cooking-oil"],
    ["Azúcar Estándar 1kg", 17, 26, "sugar,bag"],
    ["Sal de Mesa 1kg", 8, 14, "salt,container"],
    ["Harina de Trigo 1kg", 16, 25, "flour,bag"],
    ["Pasta para Sopa 500g", 12, 20, "pasta"],
    ["Atún en Lata 140g", 14, 23, "canned-tuna"],
    ["Puré de Tomate 400g", 11, 18, "tomato-sauce"],
    ["Café Molido 250g", 48, 82, "ground-coffee"],
  ],
  Lácteos: [
    ["Leche Entera 1L", 19, 27, "milk,carton"],
    ["Yogur Natural 1L", 24, 38, "yogurt"],
    ["Queso Panela 400g", 42, 65, "white-cheese"],
    ["Queso Manchego 250g", 38, 58, "cheese-wheel"],
    ["Mantequilla 200g", 26, 40, "butter"],
    ["Crema Ácida 250ml", 18, 29, "sour-cream"],
    ["Queso Oaxaca 400g", 44, 68, "string-cheese"],
    ["Leche Deslactosada 1L", 21, 30, "milk-bottle"],
    ["Yogur Griego 150g", 15, 24, "greek-yogurt"],
    ["Queso Crema 190g", 22, 35, "cream-cheese"],
  ],
  Limpieza: [
    ["Detergente en Polvo 1kg", 32, 52, "laundry-detergent"],
    ["Jabón para Trastes 750ml", 20, 32, "dish-soap"],
    ["Cloro 1L", 12, 20, "bleach,bottle"],
    ["Suavizante de Telas 1L", 24, 38, "fabric-softener"],
    ["Papel Higiénico 4 Rollos", 30, 48, "toilet-paper"],
    ["Servilletas 100pz", 10, 17, "napkins"],
    ["Fibra para Trastes", 6, 12, "scrub-sponge"],
    ["Limpiador Multiusos 1L", 22, 36, "cleaning-spray"],
    ["Bolsas para Basura 20pz", 18, 30, "trash-bags"],
    ["Desinfectante en Aerosol", 35, 56, "disinfectant-spray"],
  ],
  Botanas: [
    ["Papas Fritas 150g", 14, 24, "potato-chips"],
    ["Cacahuates Japoneses 200g", 16, 27, "peanuts"],
    ["Galletas Saladas 200g", 13, 22, "crackers"],
    ["Chicharrón de Cerdo 100g", 15, 26, "pork-rinds"],
    ["Palomitas de Microondas", 12, 21, "popcorn"],
    ["Totopos 200g", 14, 23, "tortilla-chips"],
    ["Chocolate en Barra 100g", 11, 19, "chocolate-bar"],
    ["Galletas Dulces 180g", 15, 25, "cookies"],
    ["Nueces Mixtas 150g", 28, 45, "mixed-nuts"],
    ["Barra de Cereal", 8, 15, "granola-bar"],
  ],
  "Higiene Personal": [
    ["Jabón de Baño", 8, 15, "bar-soap"],
    ["Shampoo 400ml", 32, 52, "shampoo-bottle"],
    ["Pasta Dental 100ml", 24, 38, "toothpaste"],
    ["Crema Corporal 250ml", 30, 48, "body-lotion"],
    ["Desodorante en Barra", 26, 42, "deodorant"],
    ["Cepillo Dental", 12, 22, "toothbrush"],
    ["Rastrillo Desechable", 9, 16, "razor"],
    ["Enjuague Bucal 500ml", 28, 45, "mouthwash"],
    ["Acondicionador 400ml", 32, 52, "hair-conditioner"],
    ["Algodón 100g", 10, 18, "cotton-balls"],
  ],
};

// Foto real de un banco de imágenes por palabra clave (no una foto del
// producto exacto, pero sí del tipo de artículo — mucho más creíble
// que dejar el catálogo demo sin imágenes). random=N evita que dos
// productos con palabras clave parecidas terminen mostrando la misma
// foto exacta.
export function urlFotoDemo(palabraClave: string, semilla: number): string {
  return `https://loremflickr.com/400/400/${palabraClave}?random=${semilla}`;
}

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
