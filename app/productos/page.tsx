"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { subirImagenSegura } from "../../lib/uploads";
import * as XLSX from "xlsx";
import { ImagePlus } from "lucide-react";
import { useIdioma } from "../../components/LanguageProvider";
import { useAuth } from "../../components/AuthProvider";

interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  precio_venta: number;
  costo: number | null;
  stock: number;
  imagen: string | null;
}

export default function Productos() {
  return (
    <Suspense fallback={null}>
      <ProductosInterno />
    </Suspense>
  );
}

function ProductosInterno() {
  const { t } = useIdioma();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [productos, setProductos] = useState<Producto[]>([]);

  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const [stock, setStock] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [editando, setEditando] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);

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

    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .eq("user_id", user.id)
      .order("id", { ascending: false });

    if (error) {
      console.error(error);
      alert(t("comun.msg_error_cargar_datos"));
      return;
    }

    if (data) setProductos(data);
  }

  async function guardar() {
    if (!user || guardando) return;

    if (!nombre.trim()) {
      alert(t("productos.msg_falta_nombre"));
      return;
    }

    const precioNum = Number(precio);
    const costoNum = costo === "" ? 0 : Number(costo);
    const stockNum = Number(stock);

    if (
      !Number.isFinite(precioNum) || precioNum < 0 ||
      !Number.isFinite(costoNum) || costoNum < 0 ||
      !Number.isFinite(stockNum) || stockNum < 0
    ) {
      alert(t("productos.msg_valores_invalidos"));
      return;
    }

    setGuardando(true);

    try {
      let imagenUrl = preview;

      if (imagen) {
        const { url, error } = await subirImagenSegura("productos", imagen);

        if (error === "tipo_invalido") {
          alert(t("productos.msg_imagen_tipo_invalido"));
          setGuardando(false);
          return;
        }
        if (error === "muy_grande") {
          alert(t("productos.msg_imagen_muy_grande"));
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
        user_id: user.id,
        imagen: imagenUrl,
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
      alert(t("productos.msg_error_guardar"));
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
    setPreview(p.imagen || "");
    setImagen(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function eliminar(id: number) {
    if (!user) return;
    if (!confirm(t("productos.confirmar_eliminar"))) return;

    try {
      const { error } = await supabase
        .from("productos")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        if (error.message.includes("foreign key") || error.code === "23503") {
          alert(t("productos.msg_error_eliminar_fk"));
        } else {
          alert(`${t("productos.msg_error_eliminar")}: ${error.message}`);
        }
        return;
      }

      await cargar();
    } catch (error) {
      console.error(error);
      alert(t("productos.msg_error_eliminar"));
    }
  }

  function limpiar() {
    setEditando(null);
    setNombre("");
    setCategoria("");
    setPrecio("");
    setCosto("");
    setStock("");
    setImagen(null);
    setPreview("");

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function exportarExcel() {
    const ws = XLSX.utils.json_to_sheet(productos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    XLSX.writeFile(wb, "productos.xlsx");
  }

  const filtrados = productos.filter((p) =>
    (p.nombre ?? "").toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <>
      <h1 className="productos-header">{t("productos.titulo")}</h1>

      <div className="card productos-form">
        <h2>{editando !== null ? t("productos.editar_producto") : t("productos.anadir_producto")}</h2>

        <div className="productos-grid">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t("productos.nombre")} />
          <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder={t("productos.categoria")} />
          <input value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder={t("productos.precio")} type="number" min="0" step="0.01" />
          <input value={costo} onChange={(e) => setCosto(e.target.value)} placeholder={t("productos.costo")} type="number" min="0" step="0.01" />
          <input value={stock} onChange={(e) => setStock(e.target.value)} placeholder={t("productos.stock")} type="number" min="0" step="1" />
        </div>

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
            if (!file) return;

            setImagen(file);
            setPreview(URL.createObjectURL(file));
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

          <button onClick={exportarExcel} className="btn-secondary">
            {t("productos.exportar_excel")}
          </button>

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

            let importados = 0;
            let omitidos = 0;

            interface FilaExcelProducto {
              nombre?: unknown;
              categoria?: unknown;
              precio_venta?: unknown;
              costo?: unknown;
              stock?: unknown;
            }

            for (const item of data as FilaExcelProducto[]) {
              const nombreItem = typeof item.nombre === "string" ? item.nombre.trim() : "";
              const precioItem = Number(item.precio_venta);
              const stockItem = Number(item.stock);
              const costoItem = item.costo != null ? Number(item.costo) : 0;

              if (
                !nombreItem ||
                !Number.isFinite(precioItem) || precioItem < 0 ||
                !Number.isFinite(stockItem) || stockItem < 0 ||
                !Number.isFinite(costoItem) || costoItem < 0
              ) {
                omitidos++;
                continue;
              }

              const { error } = await supabase.from("productos").insert([
                {
                  nombre: nombreItem,
                  categoria: typeof item.categoria === "string" ? item.categoria : "",
                  precio_venta: precioItem,
                  costo: costoItem,
                  stock: stockItem,
                  user_id: user.id,
                },
              ]);

              if (error) {
                omitidos++;
              } else {
                importados++;
              }
            }

            if (excelInputRef.current) excelInputRef.current.value = "";

            await cargar();
            alert(
              t("productos.msg_importacion_resultado")
                .replace("{importados}", String(importados))
                .replace("{omitidos}", String(omitidos))
            );
          }}
        />
      </div>

      <input
        style={{ marginTop: 24 }}
        placeholder={t("productos.buscar")}
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div className="tabla" style={{ marginTop: 24 }}>
        <table>
          <thead>
            <tr>
              <th>{t("productos.col_imagen")}</th>
              <th>{t("productos.col_producto")}</th>
              <th>{t("productos.categoria")}</th>
              <th>{t("productos.precio")}</th>
              <th>{t("productos.costo")}</th>
              <th>{t("productos.stock")}</th>
              <th>{t("productos.col_acciones")}</th>
            </tr>
          </thead>

          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.imagen ? (
                    <img src={p.imagen} alt={p.nombre} className="product-image" />
                  ) : "—"}
                </td>

                <td>{p.nombre}</td>
                <td>{p.categoria}</td>
                <td>${p.precio_venta}</td>
                <td>${p.costo ?? 0}</td>
                <td>{p.stock}</td>

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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}