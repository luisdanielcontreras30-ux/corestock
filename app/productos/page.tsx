"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "../../lib/supabase";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { subirImagenSegura } from "../../lib/uploads";
import { redimensionarParaSubir } from "../../lib/imagenes";
import { analizarProductoConIA, ErrorAnalisisIA } from "../../lib/iaAcciones";
import { IA_DISPONIBLE } from "../../lib/soporte";
import { mensajeErrorSeguro } from "../../lib/errores";
import { normalizarTexto } from "../../lib/normalizarTexto";
import { formatoMoneda } from "../ventas/utils";
import * as XLSX from "xlsx";
import { ImagePlus, Package, Plus, Sparkles, Eraser, Inbox, Star, MapPin, ChevronDown } from "lucide-react";
import SelectorPersonalizado, { OpcionSelector } from "../../components/SelectorPersonalizado";
import CampoConSugerencias from "../../components/CampoConSugerencias";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import { useAuth } from "../../components/AuthProvider";
import { useMiembroActivo } from "../../components/MiembroActivoProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import SinPermiso from "../../components/SinPermiso";
import { guardarBorrador, leerBorrador, borrarBorrador } from "../../lib/borrador";

const CLAVE_BORRADOR = "corestock-borrador-producto";

interface BorradorProducto {
  nombre: string;
  categoria: string;
  precio: number;
  costo_de_producion: number | null;
  stock: number;
  stockMinimo: number;
  descripcion: string;
}

interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  precio_venta: number;
  costo: number | null;
  stock: number;
  stock_minimo: number | null;
  imagen: string | null;
  descripcion: string | null;
}

export default function Productos() {
  return (
    <Suspense fallback={null}>
      <ProductosInterno />
    </Suspense>
  );
}

function ProductosInterno() {
  const { t, idioma } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();
  const { user } = useAuth();
  const { puede } = useMiembroActivo();
  const router = useRouter();
  // Sufijado con el id de quien tiene la sesión — sin esto, dos cuentas
  // de negocio distintas que compartan el mismo navegador (ej. una
  // terminal de venta) verían y sobrescribirían el borrador de la otra.
  const claveBorrador = user ? `${CLAVE_BORRADOR}-${user.id}` : null;
  const searchParams = useSearchParams();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  // Ubicación (traspasos) y calificación por ventas de cada producto —
  // se cargan aparte de "productos" porque dependen de otras tablas
  // (stock_ubicaciones/ubicaciones, ventas) que pueden no existir
  // todavía en cuentas viejas; un fallo ahí nunca debe tumbar la lista
  // de productos en sí. Mapa producto_id -> valor calculado.
  const [ubicacionPorProducto, setUbicacionPorProducto] = useState<Map<number, string>>(new Map());
  const [calificacionPorProducto, setCalificacionPorProducto] = useState<Map<number, number>>(new Map());
  // Lista completa de almacenes secundarios (Traspasos) y el stock de
  // cada producto en cada uno — producto_id -> (ubicacion_id -> stock).
  // Separado de ubicacionPorProducto (el resumen "Bodega Norte, Tienda"
  // de la tarjeta) porque ahí sí hace falta el desglose completo,
  // incluyendo almacenes en 0, para el panel que se abre al tocar la
  // tarjeta.
  const [ubicaciones, setUbicaciones] = useState<{ id: number; nombre: string }[]>([]);
  const [stockPorUbicacion, setStockPorUbicacion] = useState<Map<number, Map<number, number>>>(new Map());
  const [productoExpandidoId, setProductoExpandidoId] = useState<number | null>(null);

  // Los tres campos leen su valor inicial de la URL (?nombre_sugerido=,
  // ?categoria_sugerida=, ?descripcion_sugerida=) cuando se llega desde
  // "Análisis de Producto" (CoreStock Plus+) — así el formulario ya
  // aparece precargado en el primer render, sin pasar por un efecto
  // que dispare un segundo render solo para sincronizar estado.
  const [nombre, setNombre] = useState(() => searchParams.get("nombre_sugerido") ?? "");
  const [categoria, setCategoria] = useState(() => searchParams.get("categoria_sugerida") ?? "");
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const [stock, setStock] = useState("");
  // Vacío por defecto, no "5" precargado — si se dejaba precargado,
  // cualquiera que no tocara el campo terminaba con el mismo umbral
  // de alerta para todos sus productos sin darse cuenta. Al guardar,
  // si queda vacío sí se usa 5 como valor de resguardo (ver guardar()).
  const [stockMinimo, setStockMinimo] = useState("");
  const [descripcion, setDescripcion] = useState(() => searchParams.get("descripcion_sugerida") ?? "");
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [editando, setEditando] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [analizandoIA, setAnalizandoIA] = useState(false);
  // Segundos restantes de enfriamiento tras un 429 (cuota de IA
  // agotada) — bloquea el botón en vez de dejar que la persona
  // reintente de inmediato y vuelva a chocar con el mismo límite.
  const [enfriamientoIA, setEnfriamientoIA] = useState(0);


  useEffect(() => {
    if (enfriamientoIA <= 0) return;
    const id = setTimeout(() => setEnfriamientoIA((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [enfriamientoIA]);

  // En celular, el formulario de alta empieza cerrado — solo la lista
  // de productos está a la vista al entrar al módulo. Se abre al
  // tocar "Nuevo producto", al editar un producto existente, o al
  // llegar desde el FAB "Nuevo producto" (que además dispara la
  // cámara). En escritorio no aplica: ahí el formulario siempre está
  // visible (ver CSS, la clase que lo oculta solo actúa en móvil).
  const [formularioAbierto, setFormularioAbierto] = useState(
    () =>
      !!(
        searchParams.get("nombre_sugerido") ||
        searchParams.get("categoria_sugerida") ||
        searchParams.get("descripcion_sugerida")
      )
  );

  // Viene del FAB móvil "Nuevo producto (con cámara)": el selector de
  // imagen abre la cámara directo (en vez del picker con opción de
  // galería) y, apenas se toma la foto, se manda sola a analizar con
  // IA. Se consume una sola vez — en cuanto se elige esa primera
  // foto se apaga (ver el onChange del input), así que "Cambiar"
  // después ya no fuerza la cámara, solo ese primer disparo desde
  // "Nuevo producto". Es un ref (no un useState): el atributo
  // "capture" se aplica al <input> a mano con setAttribute justo
  // antes del .click() programático, en el mismo tick — si fuera
  // estado de React, el cambio no se pintaría en el DOM sino hasta
  // el siguiente render, y el .click() abriría el picker normal en
  // vez de la cámara.
  const capturaCamaraRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      cargar();
      cargarUbicacionesYCalificaciones();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Viene del FAB móvil "Nuevo producto (con cámara)" — abre el
  // selector de imagen directo para que no sea un botón sin efecto.
  // Se limpia el parámetro de la URL apenas se consume: así, si el
  // usuario ya está en /productos y toca "Nuevo producto" de nuevo,
  // router.push manda una URL distinta a la actual (no la misma que
  // Next.js ignoraría por no haber cambio) y este efecto vuelve a
  // dispararse en vez de quedarse con el estado de la primera vez.
  useEffect(() => {
    if (searchParams.get("camara") === "1" && fileInputRef.current) {
      setFormularioAbierto(true);
      capturaCamaraRef.current = true;
      fileInputRef.current.setAttribute("capture", "environment");
      fileInputRef.current.click();
      router.replace("/productos", { scroll: false });
    }
  }, [searchParams, router]);

  // Los campos y "formularioAbierto" ya se precargaron arriba (estado
  // inicial perezoso, leído una sola vez de la URL) — este efecto solo
  // limpia la URL para que no se vuelvan a aplicar si la persona
  // refresca la página o navega de vuelta a /productos.
  useEffect(() => {
    if (
      searchParams.get("nombre_sugerido") ||
      searchParams.get("categoria_sugerida") ||
      searchParams.get("descripcion_sugerida")
    ) {
      router.replace("/productos", { scroll: false });
    }
  }, [searchParams, router]);

  // Recupera lo que ya se había escrito si la página se recargó a
  // medio llenar "Nuevo producto" — solo cuando no viene de Análisis
  // de Producto (esos campos ya tienen prioridad, arriba) y solo para
  // un producto nuevo, no para una edición en curso (la foto no se
  // guarda aquí — un File no se puede serializar — así que restaurar
  // un borrador de edición dejaría el resto de los campos del
  // producto original sin cargar).
  useEffect(() => {
    if (!claveBorrador) return;

    if (
      searchParams.get("nombre_sugerido") ||
      searchParams.get("categoria_sugerida") ||
      searchParams.get("descripcion_sugerida")
    ) {
      return;
    }

    const borrador = leerBorrador<BorradorProducto>(claveBorrador);
    if (!borrador) return;

    setNombre(borrador.nombre);
    setCategoria(borrador.categoria);
    setPrecio(borrador.precio);
    setCosto(borrador.costo);
    setStock(borrador.stock);
    setStockMinimo(borrador.stockMinimo);
    setDescripcion(borrador.descripcion);

    if (
      borrador.nombre ||
      borrador.categoria ||
      borrador.precio ||
      borrador.costo ||
      borrador.stock ||
      borrador.stockMinimo ||
      borrador.descripcion
    ) {
      setFormularioAbierto(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveBorrador]);

  // Guarda el borrador en cada cambio — solo mientras se está creando
  // un producto nuevo (no durante una edición, para no arriesgar mezclar
  // el borrador con los datos de un producto ya existente).
  useEffect(() => {
    if (!claveBorrador || editando !== null) return;

    const vacio =
      !nombre && !categoria && !precio && !costo && !stock && !stockMinimo && !descripcion;

    if (vacio) {
      borrarBorrador(claveBorrador);
      return;
    }

    guardarBorrador<BorradorProducto>(claveBorrador, {
      nombre,
      categoria,
      precio,
      costo,
      stock,
      stockMinimo,
      descripcion,
    });
  }, [claveBorrador, nombre, categoria, precio, costo, stock, stockMinimo, descripcion, editando]);

  async function cargar() {
    if (!user) return;

    setCargando(true);
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error(error);
      mostrarToast(t("comun.msg_error_cargar_datos"), "error");
      setCargando(false);
      return;
    }

    if (data) setProductos(data);
    setCargando(false);
  }

  // Mejor esfuerzo, nunca bloquea la lista de productos: la ubicación
  // viene de stock_ubicaciones (supabase_traspasos.sql, puede no
  // existir todavía en cuentas viejas) y la calificación se deriva de
  // ventas.producto_id. Un producto sin filas en stock_ubicaciones no
  // está "mal" — solo nunca se registró en ningún traspaso, así que se
  // muestra como ubicación desconocida en vez de dejarlo en blanco.
  async function cargarUbicacionesYCalificaciones() {
    try {
      // Las dos consultas son independientes — en paralelo en vez de
      // una tras otra. "ubicaciones" trae TODOS los almacenes de la
      // cuenta (aunque un producto no tenga nada en alguno, para poder
      // mostrarlo con 0 en el desglose), y "stock_ubicaciones" sin el
      // filtro de stock > 0 que sí usa el resumen de la tarjeta, porque
      // aquí también hace falta saber los almacenes en 0.
      const [
        { data: filasUbicacionTabla, error: errorTablaUbicaciones },
        { data: filasStock, error: errorStock },
      ] = await Promise.all([
        supabase.from("ubicaciones").select("id, nombre").order("nombre"),
        supabase.from("stock_ubicaciones").select("producto_id, ubicacion_id, stock"),
      ]);

      if (!errorTablaUbicaciones && filasUbicacionTabla) {
        setUbicaciones(filasUbicacionTabla);
      }

      if (!errorStock && filasStock) {
        const nombrePorUbicacionId = new Map((filasUbicacionTabla ?? []).map((u) => [u.id, u.nombre]));
        const detalle = new Map<number, Map<number, number>>();
        const resumen = new Map<number, string>();

        for (const fila of filasStock as { producto_id: number; ubicacion_id: number; stock: number }[]) {
          if (!detalle.has(fila.producto_id)) detalle.set(fila.producto_id, new Map());
          detalle.get(fila.producto_id)!.set(fila.ubicacion_id, fila.stock);

          if (fila.stock > 0) {
            const nombre = nombrePorUbicacionId.get(fila.ubicacion_id);
            if (nombre) {
              const actual = resumen.get(fila.producto_id);
              resumen.set(
                fila.producto_id,
                actual && !actual.includes(nombre) ? `${actual}, ${nombre}` : actual ?? nombre
              );
            }
          }
        }

        setStockPorUbicacion(detalle);
        setUbicacionPorProducto(resumen);
      }
    } catch (error) {
      console.error("No se pudo cargar la ubicación de los productos:", error);
    }

    try {
      // Acotado a los últimos 90 días — sin esto se traía TODO el
      // historial de ventas de la cuenta solo para pintar 1-5
      // estrellitas de popularidad, una consulta cada vez más pesada
      // y lenta con cada año de operación. La calificación es "qué
      // tanto se vende ahora", no un acumulado histórico completo.
      const hace90Dias = new Date();
      hace90Dias.setDate(hace90Dias.getDate() - 90);

      const { data: ventasData, error: errorVentas } = await supabase
        .from("ventas")
        .select("producto_id, cantidad")
        .gte("fecha", hace90Dias.toISOString());

      if (!errorVentas && ventasData) {
        const unidadesPorProducto = new Map<number, number>();
        for (const v of ventasData as { producto_id: number | null; cantidad: number }[]) {
          if (v.producto_id == null) continue;
          unidadesPorProducto.set(v.producto_id, (unidadesPorProducto.get(v.producto_id) ?? 0) + Number(v.cantidad));
        }

        // Calificación relativa (1-5 estrellas) por percentil de
        // unidades vendidas entre los productos que sí han tenido
        // ventas — sin ventas no aparece en el mapa (0 estrellas en la
        // tarjeta). Es relativa al propio catálogo porque no hay un
        // umbral universal de "cuánto es vender mucho".
        const ordenados = Array.from(unidadesPorProducto.entries()).sort((a, b) => b[1] - a[1]);
        const nuevasCalificaciones = new Map<number, number>();
        ordenados.forEach(([productoId], indice) => {
          const percentil = indice / ordenados.length;
          const estrellas = percentil < 0.2 ? 5 : percentil < 0.4 ? 4 : percentil < 0.6 ? 3 : percentil < 0.8 ? 2 : 1;
          nuevasCalificaciones.set(productoId, estrellas);
        });
        setCalificacionPorProducto(nuevasCalificaciones);
      }
    } catch (error) {
      console.error("No se pudo calcular la calificación de los productos:", error);
    }
  }

  async function guardar() {
    if (!user || guardando) return;

    if (!nombre.trim()) {
      mostrarToast(t("productos.msg_falta_nombre"), "error");
      return;
    }

    const precioNum = Number(precio);
    const costoNum = costo === "" ? 0 : Number(costo);
    const stockNum = Number(stock);
    const stockMinimoNum = stockMinimo === "" ? 5 : Number(stockMinimo);

    if (
      !Number.isFinite(precioNum) || precioNum < 0 ||
      !Number.isFinite(costoNum) || costoNum < 0 ||
      !Number.isFinite(stockNum) || stockNum < 0 ||
      !Number.isFinite(stockMinimoNum) || stockMinimoNum < 0
    ) {
      mostrarToast(t("productos.msg_valores_invalidos"), "error");
      return;
    }

    setGuardando(true);

    try {
      let imagenUrl = preview;

      if (imagen) {
        const archivoParaSubir = await redimensionarParaSubir(imagen);
        const { url, error } = await subirImagenSegura("productos", archivoParaSubir);

        if (error === "tipo_invalido") {
          mostrarToast(t("productos.msg_imagen_tipo_invalido"), "error");
          setGuardando(false);
          return;
        }
        if (error === "muy_grande") {
          mostrarToast(t("productos.msg_imagen_muy_grande"), "error");
          setGuardando(false);
          return;
        }
        if (url) imagenUrl = url;
      }

      const producto = {
        nombre: nombre.trim(),
        categoria,
        precio_venta: precioNum,
        costo: costoNum,
        stock: stockNum,
        stock_minimo: stockMinimoNum,
        imagen: imagenUrl,
        descripcion: descripcion.trim() || null,
      };

      if (editando !== null) {
        const { error } = await supabase
          .from("productos")
          .update(producto)
          .eq("id", editando);
        if (error) throw error;
      } else {
        // user_id solo hace falta al crear — al editar, la fila ya
        // tiene el dueño correcto y no debe tocarse (para un miembro
        // del equipo, escribir su propio auth.uid() aquí rompería la
        // pertenencia del producto al negocio).
        const negocioId = await obtenerNegocioId(user.id);
        const { error } = await supabase
          .from("productos")
          .insert([{ ...producto, user_id: negocioId }]);
        if (error) throw error;
      }

      limpiar();
      await cargar();
    } catch (error) {
      console.error(error);
      mostrarToast(t("productos.msg_error_guardar"), "error");
    } finally {
      setGuardando(false);
    }
  }

  function editar(p: Producto) {
    setFormularioAbierto(true);
    // En celular el formulario está cerrado por defecto y solo se abre
    // al editar — sin esto, alguien editando un producto lejos en la
    // lista no vería que el formulario ya apareció arriba.
    window.scrollTo({ top: 0, behavior: "smooth" });
    setEditando(p.id);
    setNombre(p.nombre);
    setCategoria(p.categoria);
    setPrecio(String(p.precio_venta));
    setCosto(p.costo != null ? String(p.costo) : "");
    setStock(String(p.stock));
    setStockMinimo(p.stock_minimo != null ? String(p.stock_minimo) : "");
    setDescripcion(p.descripcion || "");
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(p.imagen || "");
    setImagen(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Compartido por el <input type="file"> (clic/cámara) y por soltar
  // un archivo arrastrado sobre la caja de subir imagen.
  function manejarArchivoSeleccionado(file: File) {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setImagen(file);
    setPreview(URL.createObjectURL(file));

    if (capturaCamaraRef.current) {
      capturaCamaraRef.current = false;
      fileInputRef.current?.removeAttribute("capture");
      analizarConIA(file);
    }
  }

  async function analizarConIA(archivoOverride?: File) {
    if (!IA_DISPONIBLE) {
      mostrarToast(t("ia_no_disponible.mensaje_corto"), "info");
      return;
    }

    const archivo = archivoOverride ?? imagen;
    if (analizandoIA) return;

    if (enfriamientoIA > 0) {
      // También se llega aquí al tomar una foto con la cámara (que
      // dispara el análisis solo, sin pasar por el botón) — sin este
      // aviso, la persona vería que "no pasó nada" tras la foto.
      mostrarToast(
        t("productos.ia_enfriamiento").replace("{segundos}", String(enfriamientoIA)),
        "error"
      );
      return;
    }

    if (!archivo) {
      mostrarToast(t("productos.msg_falta_foto_ia"), "error");
      return;
    }

    setAnalizandoIA(true);
    try {
      const resultado = await analizarProductoConIA(archivo, idioma, categorias);

      // Los tres campos que describe la foto se reemplazan SIEMPRE,
      // incluso si la IA no reconoció la categoría (entonces queda
      // vacía). Cada análisis es un producto distinto: quedarse con la
      // categoría del anterior es lo que hacía que al analizar un
      // teclado siguiera puesto "Ratones".
      //
      // Precio, costo y stock no se tocan: eso no sale de una foto, lo
      // escribe la persona.
      setNombre(resultado.nombre);
      setCategoria(resultado.categoria || "");
      setDescripcion(resultado.descripcion);
      mostrarToast(t("productos.msg_ia_completado"), "exito");
    } catch (error) {
      console.error(error);
      // 429 = sin cuota por ahora: reintentar de inmediato solo vuelve
      // a chocar con el mismo límite, así que se bloquea el botón con
      // una cuenta regresiva en vez de dejarlo disponible enseguida.
      if (error instanceof ErrorAnalisisIA && error.status === 429) {
        setEnfriamientoIA(60);
      }
      const detalle = mensajeErrorSeguro(error);
      mostrarToast(detalle || t("productos.msg_error_analizar_ia"), "error");
    } finally {
      setAnalizandoIA(false);
    }
  }

  async function eliminar(id: number) {
    if (!user) return;
    if (!(await confirmar(t("productos.confirmar_eliminar"), { peligroso: true }))) return;

    try {
      const { error } = await supabase
        .from("productos")
        .delete()
        .eq("id", id);

      if (error) {
        console.error(error);
        if (error.message.includes("foreign key") || error.code === "23503") {
          mostrarToast(t("productos.msg_error_eliminar_fk"), "error");
        } else {
          mostrarToast(t("productos.msg_error_eliminar"), "error");
        }
        return;
      }

      await cargar();
    } catch (error) {
      console.error(error);
      mostrarToast(t("productos.msg_error_eliminar"), "error");
    }
  }

  // Vacía el formulario y ya: NO cierra la pantalla ni sale del modo
  // edición. Es lo que necesita el botón "Borrar todo", que sirve para
  // empezar de cero con el formulario delante, no para irse.
  function limpiarCampos() {
    setNombre("");
    setCategoria("");
    setPrecio("");
    setCosto("");
    setStock("");
    setStockMinimo("");
    setDescripcion("");
    if (claveBorrador) borrarBorrador(claveBorrador);
    limpiarImagen();
  }

  const hayAlgoQueBorrar = !!(
    nombre ||
    categoria ||
    precio ||
    costo ||
    stock ||
    stockMinimo ||
    descripcion ||
    preview
  );

  async function borrarTodo() {
    if (!hayAlgoQueBorrar) return;

    // Se pregunta porque es un botón que destruye trabajo y está justo
    // al lado de Guardar: un toque de más en un celular no debería
    // costar los datos ya escritos.
    if (!(await confirmar(t("productos.confirmar_borrar_todo"), { peligroso: true }))) return;

    limpiarCampos();
    mostrarToast(t("productos.msg_campos_borrados"), "exito");
  }

  function limpiar() {
    setEditando(null);
    limpiarCampos();
    // Después de guardar o cancelar, vuelve a la lista en celular (ahí
    // es donde el formulario se cierra por completo; en escritorio no
    // tiene efecto visual, siempre queda visible).
    setFormularioAbierto(false);
  }

  // Solo la foto, sin tocar el resto del formulario — a diferencia de
  // limpiar() que resetea todo (pensado para después de guardar/cancelar).
  function limpiarImagen() {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setImagen(null);
    setPreview("");

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Sin useMemo, estas dos listas se recalculaban en cada render —
  // incluida cada tecla escrita en el formulario de alta/edición de
  // producto (nombre, precio, etc.), que no tiene nada que ver con
  // la búsqueda ni el filtro de categoría.
  const categorias = useMemo(
    () =>
      Array.from(
        new Set(productos.map((p) => p.categoria).filter((c): c is string => !!c?.trim()))
      ).sort((a, b) => a.localeCompare(b)),
    [productos]
  );

  const filtrados = useMemo(
    () =>
      productos.filter(
        (p) =>
          normalizarTexto(p.nombre ?? "").includes(normalizarTexto(busqueda)) &&
          (filtroCategoria === "" || p.categoria === filtroCategoria)
      ),
    [productos, busqueda, filtroCategoria]
  );

  // Separa la tabla en secciones por categoría (orden alfabético, con
  // "Sin categoría" al final) en vez de una lista plana — más fácil de
  // ubicar un producto cuando el catálogo tiene muchas categorías.
  const gruposCategoria = useMemo(() => {
    const sinCategoria = t("productos.sin_categoria");
    const mapa = new Map<string, typeof filtrados>();

    for (const p of filtrados) {
      const categoriaLimpia = p.categoria?.trim();
      const etiqueta = categoriaLimpia ? categoriaLimpia : sinCategoria;
      const lista = mapa.get(etiqueta);
      if (lista) {
        lista.push(p);
      } else {
        mapa.set(etiqueta, [p]);
      }
    }

    return Array.from(mapa.entries())
      .sort(([a], [b]) => {
        if (a === sinCategoria) return 1;
        if (b === sinCategoria) return -1;
        return a.localeCompare(b);
      })
      .map(([etiqueta, items]) => ({ etiqueta, items }));
  }, [filtrados, t]);

  function exportarExcel() {
    // Solo las columnas que la importación también sabe leer — sin el
    // id interno ni la URL cruda de la imagen, que no aportan nada
    // útil al abrir el archivo en Excel. Exporta lo que se está
    // viendo (respeta la búsqueda/filtro activos), no todo el catálogo.
    const datos = filtrados.map((p) => ({
      nombre: p.nombre,
      categoria: p.categoria,
      // precio_venta/costo son numeric en Postgres — Supabase los
      // devuelve como string. Sin convertir, json_to_sheet los escribe
      // como texto en la hoja y =SUMA(...) sobre esa columna da 0.
      precio_venta: Number(p.precio_venta),
      ...(puede("ver_ganancias") ? { costo: Number(p.costo ?? 0) } : {}),
      stock: p.stock,
      stock_minimo: p.stock_minimo ?? 5,
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    XLSX.writeFile(wb, "productos.xlsx");
  }

  if (!puede("ver_inventario") && !puede("gestionar_inventario")) {
    return (
      <main
        className="fade-up"
        style={{ display: "flex", flexDirection: "column", gap: 24 }}
      >
        <EncabezadoModulo
          Icono={Package}
          color="#22c55e"
          titulo={t("productos.titulo")}
          subtitulo={t("productos.subtitulo")}
        />
        <SinPermiso />
      </main>
    );
  }

  return (
    <>
      <div className="productos-header">
        <EncabezadoModulo
          Icono={Package}
          color="#22c55e"
          titulo={t("productos.titulo")}
          subtitulo={t("productos.subtitulo")}
        />
      </div>

      {puede("gestionar_inventario") && (
      <>
      <button
        type="button"
        className="productos-boton-nuevo-movil"
        onClick={() => setFormularioAbierto((v) => !v)}
      >
        <Plus size={16} />
        {editando !== null ? t("productos.editar_producto") : t("productos.anadir_producto")}
      </button>

      <div className={`card productos-form${formularioAbierto ? "" : " productos-form-cerrado-movil"}`}>
        <h2>{editando !== null ? t("productos.editar_producto") : t("productos.anadir_producto")}</h2>

        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={t("productos.nombre")}
          disabled={analizandoIA}
          className={analizandoIA ? "campo-ia-cargando" : undefined}
        />

        <div className="campo-categoria-datalist">
          <CampoConSugerencias
            value={categoria}
            onChange={setCategoria}
            opciones={categorias}
            placeholder={t("productos.categoria")}
            disabled={analizandoIA}
            className={analizandoIA ? "campo-ia-cargando" : undefined}
          />
        </div>

        {puede("ver_ganancias") ? (
          <div className="productos-grid-2col">
            <input value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder={t("productos.precio")} type="number" min="0" step="0.01" />
            <input value={costo} onChange={(e) => setCosto(e.target.value)} placeholder={t("productos.costo")} type="number" min="0" step="0.01" />
          </div>
        ) : (
          <input value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder={t("productos.precio")} type="number" min="0" step="0.01" />
        )}

        <div className="productos-grid-2col">
          <input value={stock} onChange={(e) => setStock(e.target.value)} placeholder={t("productos.stock")} type="number" min="0" step="1" />
          <input value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} placeholder={t("productos.stock_minimo")} type="number" min="0" step="1" />
        </div>

        <div className="campo-descripcion-wrap">
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={t("productos.descripcion_placeholder")}
            rows={2}
            disabled={analizandoIA}
            className={analizandoIA ? "campo-ia-cargando" : undefined}
          />
          <button
            type="button"
            className="btn-generar-ia-inline"
            disabled={analizandoIA || enfriamientoIA > 0}
            onClick={() => analizarConIA()}
          >
            <Sparkles size={14} />
            {analizandoIA
              ? t("productos.analizando_ia")
              : enfriamientoIA > 0
                ? t("productos.ia_enfriamiento_corto").replace("{segundos}", String(enfriamientoIA))
                : t("productos.analizar_ia")}
          </button>
        </div>

        {/* UPLOAD IMAGE */}
        <div
          className="upload-box"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) manejarArchivoSeleccionado(file);
          }}
        >
          {!preview ? (
            <>
              <ImagePlus size={34} color="var(--text-muted)" />
              <p>{t("productos.subir_imagen")}</p>
              <p className="upload-box-subtexto">{t("productos.subir_imagen_subtexto")}</p>
            </>
          ) : (
            <div>
              {/* preview es un blob: URL de URL.createObjectURL(), nunca
                  toca la red — no hay nada que next/image optimice aquí,
                  y ese componente no soporta blob: sin unoptimized. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt={t("productos.subir_imagen")} className="upload-box-preview" />

              <div className="productos-actions" style={{ marginTop: 10 }}>
                <button
                  className="btn-edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  {t("productos.cambiar")}
                </button>

                <button
                  className="btn-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    limpiarImagen();
                  }}
                >
                  {t("productos.quitar")}
                </button>
              </div>
            </div>
          )}
        </div>

        <input
          hidden
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) manejarArchivoSeleccionado(file);
          }}
        />

        {/* BUTTONS */}
        <div className="productos-toolbar">
          <button onClick={guardar} className="btn-primary" disabled={guardando}>
            {guardando
              ? t("productos.guardando")
              : editando !== null
              ? t("productos.actualizar")
              : t("productos.guardar")}
          </button>

          {puede("exportar_datos") && (
            <button onClick={exportarExcel} className="btn-secondary">
              {t("productos.exportar_excel")}
            </button>
          )}

          <button onClick={() => excelInputRef.current?.click()} className="btn-secondary">
            {t("productos.importar_excel")}
          </button>

          {/* Solo al dar de alta uno nuevo. Editando no aparece: ahí
              vaciar el formulario dejaría "Actualizar <producto>" con
              todo en blanco, y el botón —justo al lado de Cancelar— se
              leería como si borrara el producto de la base. Cancelar ya
              hace lo correcto en ese caso. */}
          {editando === null && (
            <button
              onClick={borrarTodo}
              className="btn-secondary"
              disabled={!hayAlgoQueBorrar || guardando}
            >
              <Eraser size={15} /> {t("productos.borrar_todo")}
            </button>
          )}

          {editando !== null && (
            <button onClick={limpiar} className="btn-delete">
              {t("productos.cancelar")}
            </button>
          )}
        </div>

        <input
          hidden
          ref={excelInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !user) return;

            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer);
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws);

            interface FilaExcelProducto {
              nombre?: unknown;
              categoria?: unknown;
              precio_venta?: unknown;
              costo?: unknown;
              stock?: unknown;
              stock_minimo?: unknown;
            }

            const negocioId = await obtenerNegocioId(user.id);

            let omitidos = 0;
            const filasValidas: {
              nombre: string;
              categoria: string;
              precio_venta: number;
              costo: number;
              stock: number;
              stock_minimo: number;
              user_id: string;
            }[] = [];

            for (const item of data as FilaExcelProducto[]) {
              const nombreItem = typeof item.nombre === "string" ? item.nombre.trim() : "";
              const precioItem = Number(item.precio_venta);
              const stockItem = Number(item.stock);
              const costoItem = item.costo != null ? Number(item.costo) : 0;
              const stockMinimoItem = item.stock_minimo != null ? Number(item.stock_minimo) : 5;

              if (
                !nombreItem ||
                !Number.isFinite(precioItem) || precioItem < 0 ||
                !Number.isFinite(stockItem) || stockItem < 0 ||
                !Number.isFinite(costoItem) || costoItem < 0 ||
                !Number.isFinite(stockMinimoItem) || stockMinimoItem < 0
              ) {
                omitidos++;
                continue;
              }

              filasValidas.push({
                nombre: nombreItem,
                categoria: typeof item.categoria === "string" ? item.categoria : "",
                precio_venta: precioItem,
                costo: costoItem,
                stock: stockItem,
                stock_minimo: stockMinimoItem,
                user_id: negocioId,
              });
            }

            // Una sola llamada con todas las filas en vez de una petición
            // por fila — con un Excel de cientos de productos, esto pasa
            // de tardar minutos a tardar segundos.
            let importados = 0;
            let fallaronAlGuardar = false;
            if (filasValidas.length > 0) {
              const { error } = await supabase.from("productos").insert(filasValidas);

              if (error) {
                // Distinto de "omitidos por datos inválidos": estas filas
                // sí tenían datos correctos, pero la inserción en la base
                // de datos falló (ej. RLS, conexión) — no hay que
                // mezclarlas con los omitidos o el usuario cree que su
                // Excel tenía errores cuando el problema fue del servidor.
                console.error(error);
                fallaronAlGuardar = true;
              } else {
                importados = filasValidas.length;
              }
            }

            if (excelInputRef.current) excelInputRef.current.value = "";

            await cargar();

            if (fallaronAlGuardar) {
              mostrarToast(
                t("productos.msg_importacion_fallo_guardado")
                  .replace("{validos}", String(filasValidas.length))
                  .replace("{omitidos}", String(omitidos)),
                "error"
              );
            } else {
              mostrarToast(
                t("productos.msg_importacion_resultado")
                  .replace("{importados}", String(importados))
                  .replace("{omitidos}", String(omitidos)),
                "exito"
              );
            }
          }}
        />
      </div>
      </>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        <input
          style={{ flex: 1, minWidth: 200 }}
          placeholder={t("productos.buscar")}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        {categorias.length > 0 && (
          <SelectorPersonalizado
            style={{ minWidth: 180 }}
            value={filtroCategoria}
            onChange={setFiltroCategoria}
          >
            <OpcionSelector value="">{t("productos.todas_categorias")}</OpcionSelector>
            {categorias.map((c) => (
              <OpcionSelector key={c} value={c}>
                {c}
              </OpcionSelector>
            ))}
          </SelectorPersonalizado>
        )}
      </div>

      {cargando ? (
        <div className="productos-tarjetas" style={{ marginTop: 24 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="producto-tarjeta">
              <div className="skeleton" style={{ width: "100%", height: 84, borderRadius: 10, animationDelay: `${i * 0.06}s` }} />
              <div className="skeleton" style={{ height: 14, borderRadius: 4, marginTop: 12, animationDelay: `${i * 0.06}s` }} />
              <div className="skeleton" style={{ height: 12, width: "60%", borderRadius: 4, marginTop: 8, animationDelay: `${i * 0.06}s` }} />
            </div>
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="productos-vacio" style={{ marginTop: 24 }}>
          <Inbox size={26} color="var(--text-muted)" />
          <span>
            {productos.length > 0 ? t("productos.sin_resultados_busqueda") : t("productos.sin_productos")}
          </span>
        </div>
      ) : (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 22 }}>
          {gruposCategoria.map((grupo) => (
            <div key={grupo.etiqueta}>
              <h3 className="productos-tarjetas-grupo-titulo">
                {grupo.etiqueta} ({grupo.items.length})
              </h3>

              <div className="productos-tarjetas">
                {grupo.items.map((p) => {
                  const estrellas = calificacionPorProducto.get(p.id) ?? 0;
                  // Si la cuenta nunca usó Traspasos, el mapa completo
                  // queda vacío — mostrar "Ubicación desconocida" en
                  // CADA tarjeta sería ruido constante para casi todos
                  // los usuarios (Traspasos es una función opcional).
                  // Solo se muestra el dato una vez que existe al
                  // menos una ubicación registrada en la cuenta.
                  const ubicacion =
                    ubicacionPorProducto.size > 0
                      ? ubicacionPorProducto.get(p.id) ?? t("traspasos.ubicacion_desconocida")
                      : null;

                  const expandido = productoExpandidoId === p.id;
                  const idDetalle = `producto-detalle-${p.id}`;

                  return (
                    <div key={p.id} className="producto-tarjeta">
                      {/* Botón real (no un div con role="button") para que
                          abrir/cerrar el desglose de stock por almacén
                          funcione con teclado y lector de pantalla igual
                          que TarjetaDesplegable — los botones de Editar/
                          Eliminar quedan afuera, como hermanos, para no
                          anidar un botón dentro de otro. */}
                      <button
                        type="button"
                        className={`producto-tarjeta-toggle${expandido ? " producto-tarjeta-toggle-abierto" : ""}`}
                        onClick={() => setProductoExpandidoId((actual) => (actual === p.id ? null : p.id))}
                        aria-expanded={expandido}
                        aria-controls={idDetalle}
                        aria-label={t("productos.ver_stock_ubicaciones")}
                      >
                        <div className="producto-tarjeta-imagen">
                          {p.imagen ? (
                            <Image src={p.imagen} alt={p.nombre} fill sizes="200px" style={{ objectFit: "cover" }} />
                          ) : (
                            <Package size={26} color="var(--text-muted)" />
                          )}
                        </div>

                        <div className="producto-tarjeta-cuerpo">
                          <p className="producto-tarjeta-nombre">{p.nombre}</p>
                          <p className="producto-tarjeta-categoria">
                            {p.categoria?.trim() ? p.categoria : t("productos.sin_categoria")}
                          </p>

                          <div className="producto-tarjeta-calificacion" title={t("productos.calificacion")}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star
                                key={n}
                                size={13}
                                fill={n <= estrellas ? "#f5b301" : "none"}
                                color={n <= estrellas ? "#f5b301" : "var(--border)"}
                              />
                            ))}
                          </div>

                          <div className="producto-tarjeta-precios">
                            <span className="producto-tarjeta-precio">{formatoMoneda(p.precio_venta)}</span>
                            {puede("ver_ganancias") && (
                              <span className="producto-tarjeta-costo">
                                {t("productos.costo")}: {formatoMoneda(p.costo ?? 0)}
                              </span>
                            )}
                          </div>

                          <div className="producto-tarjeta-fila-info">
                            <span className="producto-tarjeta-stock">
                              {t("productos.stock")}: <strong>{p.stock}</strong>
                            </span>
                            {ubicacion && (
                              <span className="producto-tarjeta-ubicacion">
                                <MapPin size={11} /> {ubicacion}
                              </span>
                            )}
                          </div>

                          <ChevronDown size={16} className="producto-tarjeta-chevron" aria-hidden="true" />
                        </div>
                      </button>

                      {/* Se desmonta al cerrar, igual que
                          TarjetaDesplegable — así no queda contenido
                          enfocable ni leído por un lector de pantalla
                          cuando está oculto. */}
                      {expandido && (
                        <div id={idDetalle} className="producto-tarjeta-detalle">
                          <p className="producto-tarjeta-detalle-titulo">{t("traspasos.stock_por_ubicacion")}</p>

                          {ubicaciones.length === 0 ? (
                            <div className="producto-tarjeta-detalle-fila">
                              <span>{t("productos.almacen_general")}</span>
                              <strong>{p.stock}</strong>
                            </div>
                          ) : (
                            <>
                              <div className="producto-tarjeta-detalle-fila">
                                <span>{t("traspasos.tienda")}</span>
                                <strong>{p.stock}</strong>
                              </div>
                              {ubicaciones.map((u) => (
                                <div key={u.id} className="producto-tarjeta-detalle-fila">
                                  <span>{u.nombre}</span>
                                  <strong>{stockPorUbicacion.get(p.id)?.get(u.id) ?? 0}</strong>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )}

                      {puede("gestionar_inventario") && (
                        <div className="productos-actions producto-tarjeta-acciones">
                          <button onClick={() => editar(p)} className="btn-edit">
                            {t("productos.editar")}
                          </button>

                          <button onClick={() => eliminar(p.id)} className="btn-delete">
                            {t("productos.eliminar")}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
