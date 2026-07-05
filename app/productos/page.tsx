"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import * as XLSX from "xlsx";

export default function Productos() {
  const [productos, setProductos] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [editando, setEditando] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;
    setUser(user);

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
    if (!user) return;

    let imagenUrl = preview;

    if (imagen) {
      const url = await subirImagen(imagen);
      if (url) imagenUrl = url;
    }

    const producto = {
      nombre,
      categoria,
      precio_venta: Number(precio),
      stock: Number(stock),
      user_id: user.id,
      imagen: imagenUrl,
    };

    if (editando) {
      await supabase.from("productos").update(producto).eq("id", editando);
    } else {
      await supabase.from("productos").insert([producto]);
    }

    limpiar();
    cargar();
  }

  function editar(p: any) {
    setEditando(p.id);
    setNombre(p.nombre);
    setCategoria(p.categoria);
    setPrecio(p.precio_venta);
    setStock(p.stock);
    setPreview(p.imagen || "");
  }

  async function eliminar(id: number) {
    await supabase.from("productos").delete().eq("id", id);
    cargar();
  }

  function limpiar() {
    setEditando(null);
    setNombre("");
    setCategoria("");
    setPrecio("");
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
      <h1 className="productos-header">Productos</h1>

      <div className="card productos-form">
        <h2>{editando ? "Editar producto" : "Añadir producto"}</h2>

        <div className="productos-grid">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" />
          <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Categoría" />
          <input value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Precio" type="number" />
          <input value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Stock" type="number" />
        </div>

        {/* UPLOAD IMAGE */}
        <div className="upload-box" onClick={() => fileInputRef.current?.click()}>
          {!preview ? (
            <>
              <div style={{ fontSize: 40 }}>📷</div>
              <p>Subir imagen</p>
            </>
          ) : (
            <div>
              <img src={preview} className="product-image" />

              <div className="productos-actions" style={{ marginTop: 10 }}>
                <button className="btn-edit" onClick={() => fileInputRef.current?.click()}>
                  Cambiar
                </button>

                <button className="btn-delete" onClick={limpiar}>
                  Quitar
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
          <button onClick={guardar} className="btn-primary">
            {editando ? "Actualizar" : "Guardar"}
          </button>

          <button onClick={exportarExcel} className="btn-secondary">
            Exportar Excel
          </button>

          <button onClick={() => excelInputRef.current?.click()} className="btn-secondary">
            Importar Excel
          </button>

          {editando && (
            <button onClick={limpiar} className="btn-delete">
              Cancelar
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
        placeholder="Buscar producto..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div className="tabla" style={{ marginTop: 24 }}>
        <table>
          <thead>
            <tr>
              <th>Imagen</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Acciones</th>
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
                <td>{p.stock}</td>

                <td>
                  <div className="productos-actions">
                    <button onClick={() => editar(p)} className="btn-edit">
                      Editar
                    </button>

                    <button onClick={() => eliminar(p.id)} className="btn-delete">
                      Eliminar
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