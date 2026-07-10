"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import * as XLSX from "xlsx";
import { ImagePlus } from "lucide-react";
import { useIdioma } from "../../components/LanguageProvider";
import { useAuth } from "../../components/AuthProvider";

export default function Productos() {
  const { t } = useIdioma();
  const { user } = useAuth();
  const [productos, setProductos] = useState<any[]>([]);

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

  async function cargar() {
    if (!user) return;

    const { data } = await supabase
      .from("productos")
      .select("*")
      .eq("user_id", user.id)
      .order("id", { ascending: false });

    if (data) setProductos(data);
  }

  async function subirImagen(file: File) {
    const fileName = `${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from("productos")
      .upload(fileName, file);

    if (error) return null;

    const { data } = supabase.storage
      .from("productos")
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  async function guardar() {
    if (!user || guardando) return;

    setGuardando(true);

    try {
      let imagenUrl = preview;

      if (imagen) {
        const url = await subirImagen(imagen);
        if (url) imagenUrl = url;
      }

      const producto = {
        nombre,
        categoria,
        precio_venta: Number(precio),
        costo: Number(costo) || 0,
        stock: Number(stock),
        user_id: user.id,
        imagen: imagenUrl,
      };

      if (editando) {
        const { error } = await supabase
          .from("productos")
          .update(producto)
          .eq("id", editando);
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

  function editar(p: any) {
    setEditando(p.id);
    setNombre(p.nombre);
    setCategoria(p.categoria);
    setPrecio(p.precio_venta);
    setCosto(p.costo ?? "");
    setStock(p.stock);
    setPreview(p.imagen || "");
  }

  async function eliminar(id: number) {
    if (!confirm(t("productos.confirmar_eliminar"))) return;

    try {
      const { error } = await supabase
        .from("productos")
        .delete()
        .eq("id", id);

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
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <>
      <h1 className="productos-header">{t("productos.titulo")}</h1>

      <div className="card productos-form">
        <h2>{editando ? t("productos.editar_producto") : t("productos.anadir_producto")}</h2>

        <div className="productos-grid">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t("productos.nombre")} />
          <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder={t("productos.categoria")} />
          <input value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder={t("productos.precio")} type="number" />
          <input value={costo} onChange={(e) => setCosto(e.target.value)} placeholder={t("productos.costo")} type="number" />
          <input value={stock} onChange={(e) => setStock(e.target.value)} placeholder={t("productos.stock")} type="number" />
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
              <img src={preview} className="product-image" />

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
              : editando
              ? t("productos.actualizar")
              : t("productos.guardar")}
          </button>

          <button onClick={exportarExcel} className="btn-secondary">
            {t("productos.exportar_excel")}
          </button>

          <button onClick={() => excelInputRef.current?.click()} className="btn-secondary">
            {t("productos.importar_excel")}
          </button>

          {editando && (
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

            for (const item of data as any[]) {
              await supabase.from("productos").insert([
                {
                  nombre: item.nombre,
                  categoria: item.categoria,
                  precio_venta: Number(item.precio_venta),
                  costo: Number(item.costo) || 0,
                  stock: Number(item.stock),
                  user_id: user.id,
                },
              ]);
            }

            cargar();
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
                    <img src={p.imagen} className="product-image" />
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