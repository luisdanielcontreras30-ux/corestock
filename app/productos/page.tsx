"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { subirImagenSegura } from "../../lib/uploads";
import { analizarProductoConIA } from "../../lib/iaAcciones";
import { formatoMoneda } from "../ventas/utils";
import * as XLSX from "xlsx";
import { ImagePlus, Package, Plus, Sparkles } from "lucide-react";
import SelectorPersonalizado, { OpcionSelector } from "../../components/SelectorPersonalizado";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import { useAuth } from "../../components/AuthProvider";
import { useMiembroActivo } from "../../components/MiembroActivoProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";

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
  const searchParams = useSearchParams();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);

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
    if (user) cargar();
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

  async function cargar() {
    if (!user) return;

    setCargando(true);
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .eq("user_id", user.id)
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
        const { url, error } = await subirImagenSegura("productos", imagen);

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
        user_id: user.id,
        imagen: imagenUrl,
        descripcion: descripcion.trim() || null,
      };

      if (editando !== null) {
        const { error } = await supabase
          .from("productos")
          .update(producto)
          .eq("id", editando)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("productos").insert([producto]);
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
    setPreview(p.imagen || "");
    setImagen(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Compartido por el <input type="file"> (clic/cámara) y por soltar
  // un archivo arrastrado sobre la caja de subir imagen.
  function manejarArchivoSeleccionado(file: File) {
    setImagen(file);
    setPreview(URL.createObjectURL(file));

    if (capturaCamaraRef.current) {
      capturaCamaraRef.current = false;
      fileInputRef.current?.removeAttribute("capture");
      analizarConIA(file);
    }
  }

  async function analizarConIA(archivoOverride?: File) {
    const archivo = archivoOverride ?? imagen;
    if (analizandoIA) return;

    if (!archivo) {
      mostrarToast(t("productos.msg_falta_foto_ia"), "error");
      return;
    }

    setAnalizandoIA(true);
    try {
      const resultado = await analizarProductoConIA(archivo, idioma, categorias);
      setNombre(resultado.nombre);
      // Si la IA no devolvió categoría (o falló al parsearla), se deja
      // lo que la persona ya haya escrito en vez de borrarlo con "".
      if (resultado.categoria) setCategoria(resultado.categoria);
      setDescripcion(resultado.descripcion);
      mostrarToast(t("productos.msg_ia_completado"), "exito");
    } catch (error) {
      console.error(error);
      const detalle = error instanceof Error ? error.message : "";
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
        .eq("id", id)
        .eq("user_id", user.id);

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

  function limpiar() {
    setEditando(null);
    setNombre("");
    setCategoria("");
    setPrecio("");
    setCosto("");
    setStock("");
    setStockMinimo("");
    setDescripcion("");
    limpiarImagen();
    // Después de guardar o cancelar, vuelve a la lista en celular (ahí
    // es donde el formulario se cierra por completo; en escritorio no
    // tiene efecto visual, siempre queda visible).
    setFormularioAbierto(false);
  }

  // Solo la foto, sin tocar el resto del formulario — a diferencia de
  // limpiar() que resetea todo (pensado para después de guardar/cancelar).
  function limpiarImagen() {
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
          (p.nombre ?? "").toLowerCase().includes(busqueda.toLowerCase()) &&
          (filtroCategoria === "" || p.categoria === filtroCategoria)
      ),
    [productos, busqueda, filtroCategoria]
  );

  function exportarExcel() {
    // Solo las columnas que la importación también sabe leer — sin el
    // id interno ni la URL cruda de la imagen, que no aportan nada
    // útil al abrir el archivo en Excel. Exporta lo que se está
    // viendo (respeta la búsqueda/filtro activos), no todo el catálogo.
    const datos = filtrados.map((p) => ({
      nombre: p.nombre,
      categoria: p.categoria,
      precio_venta: p.precio_venta,
      ...(puede("ver_ganancias") ? { costo: p.costo ?? 0 } : {}),
      stock: p.stock,
      stock_minimo: p.stock_minimo ?? 5,
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    XLSX.writeFile(wb, "productos.xlsx");
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
          <input
            list="lista-categorias-nuevo-producto"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder={t("productos.categoria")}
            disabled={analizandoIA}
            className={analizandoIA ? "campo-ia-cargando" : undefined}
          />
          <datalist id="lista-categorias-nuevo-producto">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
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
            disabled={analizandoIA}
            onClick={() => analizarConIA()}
          >
            <Sparkles size={14} />
            {analizandoIA ? t("productos.analizando_ia") : t("productos.analizar_ia")}
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
                user_id: user.id,
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
        <div className="card" style={{ marginTop: 24 }}>{t("header.cargando")}</div>
      ) : (
        <div className="tabla" style={{ marginTop: 24 }}>
          <table>
            <thead>
              <tr>
                <th>{t("productos.col_imagen")}</th>
                <th>{t("productos.col_producto")}</th>
                <th>{t("productos.categoria")}</th>
                <th>{t("productos.precio")}</th>
                {puede("ver_ganancias") && <th>{t("productos.costo")}</th>}
                <th>{t("productos.stock")}</th>
                {puede("gestionar_inventario") && <th>{t("productos.col_acciones")}</th>}
              </tr>
            </thead>

            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      3 + (puede("ver_ganancias") ? 1 : 0) + 1 + (puede("gestionar_inventario") ? 1 : 0) + 1
                    }
                    style={{ textAlign: "center", padding: 30 }}
                  >
                    {productos.length > 0
                      ? t("productos.sin_resultados_busqueda")
                      : t("productos.sin_productos")}
                  </td>
                </tr>
              ) : (
                filtrados.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.imagen ? (
                        <img src={p.imagen} alt={p.nombre} className="product-image" />
                      ) : "—"}
                    </td>

                    <td>{p.nombre}</td>
                    <td>{p.categoria?.trim() ? p.categoria : t("productos.sin_categoria")}</td>
                    <td>{formatoMoneda(p.precio_venta)}</td>
                    {puede("ver_ganancias") && <td>{formatoMoneda(p.costo ?? 0)}</td>}
                    <td>{p.stock}</td>

                    {puede("gestionar_inventario") && (
                      <td>
                        <div className="productos-actions">
                          <button onClick={() => editar(p)} className="btn-edit">
                            {t("productos.editar")}
                          </button>

                          <button onClick={() => eliminar(p.id)} className="btn-delete">
                            {t("productos.eliminar")}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}