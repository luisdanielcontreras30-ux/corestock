import { supabase } from "./supabase";
import { PRODUCTOS_DEMO, CLIENTES_DEMO, PROVEEDORES_DEMO } from "./datosDemo";
import { MetodoPago } from "../app/ventas/types";

// Cuenta demo: cuando este correo entra por primera vez (catálogo
// vacío), se le llena la cuenta con datos de muestra amplios y
// variados para que pueda explorar la app como si ya llevara tiempo
// usándola. Solo aplica a este correo exacto — nadie más recibe datos
// de muestra automáticamente.
const CORREO_DEMO = "daniel@gmail.com";

function aleatorioEntre(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function elegirAlAzar<T>(lista: T[]): T {
  return lista[aleatorioEntre(0, lista.length - 1)];
}

function fechaHaceDias(diasAtras: number): Date {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - diasAtras);
  fecha.setHours(aleatorioEntre(8, 21), aleatorioEntre(0, 59), 0, 0);
  return fecha;
}

const METODOS_PAGO: MetodoPago[] = ["efectivo", "efectivo", "efectivo", "tarjeta", "transferencia"];

// Solo siembra si el correo coincide Y la cuenta todavía no tiene
// productos — así nunca duplica datos en logins posteriores, ni toca
// una cuenta a la que ya se le agregaron productos reales.
export async function sembrarDatosDemoSiAplica(userId: string, correo: string | null | undefined) {
  if (correo?.trim().toLowerCase() !== CORREO_DEMO) return;

  const { count, error: errorConteo } = await supabase
    .from("productos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (errorConteo) throw errorConteo;
  if (count && count > 0) return;

  // 1) PRODUCTOS — ~10 por categoría.
  const filasProductos = Object.entries(PRODUCTOS_DEMO).flatMap(([categoria, items]) =>
    items.map(([nombre, costo, precio]) => ({
      user_id: userId,
      nombre,
      categoria,
      costo,
      precio_venta: precio,
      stock: aleatorioEntre(15, 120),
      stock_minimo: aleatorioEntre(5, 15),
      activo: true,
    }))
  );

  const { data: productosCreados, error: errorProductos } = await supabase
    .from("productos")
    .insert(filasProductos)
    .select("id, nombre, precio_venta, costo");

  if (errorProductos) throw errorProductos;
  if (!productosCreados || productosCreados.length === 0) return;

  // 2) CLIENTES
  const { data: clientesCreados, error: errorClientes } = await supabase
    .from("clientes")
    .insert(CLIENTES_DEMO.map((c) => ({ ...c, notas: null, user_id: userId })))
    .select("id");

  if (errorClientes) throw errorClientes;

  // 3) PROVEEDORES
  const { data: proveedoresCreados, error: errorProveedores } = await supabase
    .from("proveedores")
    .insert(PROVEEDORES_DEMO.map((p) => ({ ...p, notas: null, activo: true, user_id: userId })))
    .select("id, nombre");

  if (errorProveedores) throw errorProveedores;

  // 4) VENTAS — historial de los últimos 45 días, repartido entre
  // productos y clientes al azar (algunas sin cliente = "público
  // general"), para que el dashboard y las gráficas tengan algo real
  // que mostrar desde el primer momento.
  const clientesIds = (clientesCreados ?? []).map((c) => c.id as number);
  const filasVentas = [];

  for (let dia = 0; dia < 45; dia++) {
    const ventasDelDia = aleatorioEntre(2, 7);
    for (let i = 0; i < ventasDelDia; i++) {
      const producto = elegirAlAzar(productosCreados);
      const cantidad = aleatorioEntre(1, 4);
      const precio = Number(producto.precio_venta);
      const total = Math.round(precio * cantidad * 100) / 100;
      const conCliente = Math.random() < 0.6;

      filasVentas.push({
        user_id: userId,
        fecha: fechaHaceDias(dia).toISOString(),
        producto: producto.nombre,
        producto_id: producto.id,
        cliente_id: conCliente && clientesIds.length > 0 ? elegirAlAzar(clientesIds) : null,
        cantidad,
        precio,
        total,
        metodo_pago: elegirAlAzar(METODOS_PAGO),
      });
    }
  }

  const { error: errorVentas } = await supabase.from("ventas").insert(filasVentas);
  if (errorVentas) throw errorVentas;

  // 5) COMPRAS — historial de reabastecimiento de los últimos 60 días.
  const proveedores = proveedoresCreados ?? [];
  if (proveedores.length > 0) {
    const filasCompras = [];
    for (let i = 0; i < 25; i++) {
      const producto = elegirAlAzar(productosCreados);
      const proveedor = elegirAlAzar(proveedores);
      const cantidad = aleatorioEntre(10, 60);
      const costoUnitario = Number(producto.costo ?? 0);

      filasCompras.push({
        user_id: userId,
        fecha: fechaHaceDias(aleatorioEntre(1, 60)).toISOString(),
        producto: producto.nombre,
        producto_id: producto.id,
        proveedor_id: proveedor.id,
        proveedor_nombre: proveedor.nombre,
        cantidad,
        costo_unitario: costoUnitario,
        total: Math.round(costoUnitario * cantidad * 100) / 100,
        nota: null,
      });
    }

    const { error: errorCompras } = await supabase.from("compras").insert(filasCompras);
    if (errorCompras) throw errorCompras;
  }

  // 6) PROMOCIONES — una específica y una general, ambas activas.
  const productoEnPromo = elegirAlAzar(productosCreados);
  const hoy = new Date();
  const enUnMes = new Date();
  enUnMes.setDate(enUnMes.getDate() + 30);

  const { error: errorPromos } = await supabase.from("promociones").insert([
    {
      user_id: userId,
      nombre: `${productoEnPromo.nombre} al 20%`,
      producto_id: productoEnPromo.id,
      producto: productoEnPromo.nombre,
      tipo: "porcentaje",
      valor: 20,
      fecha_inicio: hoy.toISOString(),
      fecha_fin: enUnMes.toISOString(),
      activa: true,
    },
    {
      user_id: userId,
      nombre: "Promoción general de temporada",
      producto_id: null,
      producto: null,
      tipo: "porcentaje",
      valor: 10,
      fecha_inicio: hoy.toISOString(),
      fecha_fin: enUnMes.toISOString(),
      activa: true,
    },
  ]);

  if (errorPromos) throw errorPromos;
}
