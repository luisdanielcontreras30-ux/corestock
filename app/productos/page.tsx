"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { subirImagenSegura } from "../../lib/uploads";
import { analizarProductoConIA } from "../../lib/iaAcciones";
import * as XLSX from "xlsx";
import { ImagePlus, Package, Sparkles } from "lucide-react";
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
  const searchParams = useSearchParams();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);

  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const [stock, setStock] = useState("");
  const [stockMinimo, setStockMinimo] = useState("5");
  const [descripcion, setDescripcion] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [editando, setEditando] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [analizandoIA, setAnalizandoIA] = useState(false);

  // Viene del FAB móvil "Nuevo producto (con cámara)": el selector de
  // imagen abre la cámara directo (en vez del picker con opción de
  // galería) y, apenas se toma la foto, se manda sola a analizar con
  // IA. Se calcula una sola vez al montar — se queda así el resto de
  // la visita a esta página, aunque después se cambie la foto.
  const [capturaCamara] = useState(() => searchParams.get("camara") === "1");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) cargar();
  }, [user]);

  // Viene del FAB móvil "Nuevo producto (con cámara)" — abre el
  // selector de imagen directo para que no sea un botón sin efecto.
  useEffect(() => {
    if (searchParams.get("camara") === "1") {
      fileInputRef.current?.click();
    }
  }, [searchParams]);

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
    setEditando(p.id);
    setNombre(p.nombre);
    setCategoria(p.categoria);
    setPrecio(String(p.precio_venta));
    setCosto(p.costo != null ? String(p.costo) : "");
    setStock(String(p.stock));
    setStockMinimo(p.stock_minimo != null ? String(p.stock_minimo) : "5");
    setDescripcion(p.descripcion || "");
    setPreview(p.imagen || "");
    setImagen(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function analizarConIA(archivoOverride?: File) {
    const archivo = archivoOverride ?? imagen;
    if (!archivo || analizandoIA) return;

    setAnalizandoIA(true);
    try {
      const resultado = await analizarProductoConIA(archivo, idioma);
      setNombre(resultado.nombre);
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
        if (error.message.includes("foreign key") || error.code === "23503") {
          mostrarToast(t("productos.msg_error_eliminar_fk"), "error");
        } else {
          mostrarToast(`${t("productos.msg_error_eliminar")}: ${error.message}`, "error");
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
    setStockMinimo("5");
    setDescripcion("");
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
      <div className="card productos-form">
        <h2>{editando !== null ? t("productos.editar_producto") : t("productos.anadir_producto")}</h2>

        <div className="productos-grid">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t("productos.nombre")} />
          <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder={t("productos.categoria")} />
          <input value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder={t("productos.precio")} type="number" min="0" step="0.01" />
          {puede("ver_ganancias") && (
            <input value={costo} onChange={(e) => setCosto(e.target.value)} placeholder={t("productos.costo")} type="number" min="0" step="0.01" />
          )}
          <input value={stock} onChange={(e) => setStock(e.target.value)} placeholder={t("productos.stock")} type="number" min="0" step="1" />
          <input value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} placeholder={t("productos.stock_minimo")} type="number" min="0" step="1" />
        </div>

        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder={t("productos.descripcion_placeholder")}
          rows={2}
          style={{ marginTop: 12, resize: "vertical" }}
        />

        {/* UPLOAD IMAGE */}
        <div className="upload-box" onClick={() => fileInputRef.current?.click()}>
          {!preview ? (
            <>
              <ImagePlus size={34} color="var(--text-muted)" />
              <p>{t("productos.subir_imagen")}</p>
            </>
          ) : (
            <div>
              <img src={preview} alt={t("productos.subir_imagen")} className="product-image" />

              <div className="productos-actions" style={{ marginTop: 10 }}>
                <button className="btn-edit" onClick={() => fileInputRef.current?.click()}>
                  {t("productos.cambiar")}
                </button>

                <button className="btn-delete" onClick={limpiar}>
                  {t("productos.quitar")}
                </button>

                {imagen && (
                  <button
                    className="btn-primary"
                    disabled={analizandoIA}
                    onClick={(e) => {
                      e.stopPropagation();
                      analizarConIA();
                    }}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Sparkles size={14} />
                    {analizandoIA ? t("productos.analizando_ia") : t("productos.analizar_ia")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <input
          hidden
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture={capturaCamara ? "environment" : undefined}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            setImagen(file);
            setPreview(URL.createObjectURL(file));

            if (capturaCamara) {
              analizarConIA(file);
            }
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
            if (filasValidas.length > 0) {
              const { error } = await supabase.from("productos").insert(filasValidas);

              if (error) {
                console.error(error);
                omitidos += filasValidas.length;
              } else {
                importados = filasValidas.length;
              }
            }

            if (excelInputRef.current) excelInputRef.current.value = "";

            await cargar();
            mostrarToast(
              t("productos.msg_importacion_resultado")
                .replace("{importados}", String(importados))
                .replace("{omitidos}", String(omitidos)),
              "exito"
            );
          }}
        />
      </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        <input
          style={{ flex: 1, minWidth: 200 }}
          placeholder={t("productos.buscar")}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        {categorias.length > 0 && (
          <select
            style={{ minWidth: 180 }}
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
          >
            <option value="">{t("productos.todas_categorias")}</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
                    <td>{p.categoria}</td>
                    <td>${p.precio_venta.toFixed(2)}</td>
                    {puede("ver_ganancias") && <td>${(p.costo ?? 0).toFixed(2)}</td>}
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