"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Warehouse, ImagePlus, MapPin, ChevronDown } from "lucide-react";
import { mensajeErrorSeguro } from "../../lib/errores";
import { subirImagenSegura } from "../../lib/uploads";
import { redimensionarParaSubir } from "../../lib/imagenes";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import RequierePlus from "../../components/RequierePlus";
import CargandoLista from "../../components/CargandoLista";
import { Almacen, ProductoEnAlmacen } from "./types";
import { cargarDatos, crearAlmacen, actualizarAlmacen, eliminarAlmacen } from "./acciones";

export default function AlmacenesPage() {
  return (
    <RequierePlus>
      <AlmacenesContenido />
    </RequierePlus>
  );
}

function AlmacenesContenido() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [productosPorAlmacen, setProductosPorAlmacen] = useState<Map<number, ProductoEnAlmacen[]>>(new Map());
  const [almacenExpandidoId, setAlmacenExpandidoId] = useState<number | null>(null);

  const [editando, setEditando] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // acciones.ts lanza sentinels sin traducir (ver comentario en
  // lib/errores.ts) para los casos donde sí hay un mensaje pensado
  // para mostrarse — esta función los traduce; null si el error no es
  // ninguno de los esperados (deja pasar a mensajeErrorSeguro/fallback).
  function mensajeAlmacen(error: unknown): string | null {
    if (!(error instanceof Error)) return null;
    switch (error.message) {
      case "NOMBRE_VACIO":
        return t("almacenes.msg_falta_nombre");
      case "ALMACEN_CON_STOCK":
        return t("almacenes.msg_con_stock");
      default:
        return null;
    }
  }

  async function obtenerDatos() {
    setLoading(true);
    try {
      const datos = await cargarDatos();
      setAlmacenes(datos.almacenes);
      setProductosPorAlmacen(datos.productosPorAlmacen);
    } catch (error) {
      console.error(error);
      mostrarToast(t("almacenes.msg_error_cargar"), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (cargandoAuth) return;

    if (!user) {
      router.push("/login");
      return;
    }

    obtenerDatos();
  }, [cargandoAuth, user]);

  function limpiarFormulario() {
    setEditando(null);
    setNombre("");
    setDescripcion("");
    setFotoUrl(null);
  }

  function editar(a: Almacen) {
    setEditando(a.id);
    setNombre(a.nombre);
    setDescripcion(a.descripcion ?? "");
    setFotoUrl(a.foto_url);
  }

  async function alSubirFoto(archivo: File) {
    setSubiendoFoto(true);

    try {
      const archivoParaSubir = await redimensionarParaSubir(archivo);
      const { url, error } = await subirImagenSegura("productos", archivoParaSubir, "almacen-");

      if (error === "tipo_invalido") {
        mostrarToast(t("almacenes.msg_foto_tipo_invalido"), "error");
      } else if (error === "muy_grande") {
        mostrarToast(t("almacenes.msg_foto_muy_grande"), "error");
      } else if (error || !url) {
        mostrarToast(t("almacenes.msg_error_foto"), "error");
      } else {
        setFotoUrl(url);
      }
    } catch (error) {
      console.error(error);
      mostrarToast(t("almacenes.msg_error_foto"), "error");
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function guardar() {
    if (guardando) return;

    setGuardando(true);
    try {
      if (editando !== null) {
        await actualizarAlmacen(editando, nombre, descripcion, fotoUrl);
      } else {
        await crearAlmacen(nombre, descripcion, fotoUrl);
      }
      limpiarFormulario();
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      mostrarToast(mensajeAlmacen(error) || mensajeErrorSeguro(error) || t("almacenes.msg_error_guardar"), "error");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: number) {
    if (!(await confirmar(t("almacenes.confirmar_eliminar"), { peligroso: true }))) return;

    try {
      await eliminarAlmacen(id);
      if (editando === id) limpiarFormulario();
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      mostrarToast(mensajeAlmacen(error) || mensajeErrorSeguro(error) || t("almacenes.msg_error_eliminar"), "error");
    }
  }

  if (cargandoAuth || !user) {
    return (
      <main className="fade-up">
        <CargandoLista />
      </main>
    );
  }

  return (
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <EncabezadoModulo
        Icono={Warehouse}
        color="#0d9488"
        titulo={t("sidebar.almacenes")}
        subtitulo={t("almacenes.subtitulo")}
      />

      {loading ? (
        <CargandoLista />
      ) : (
        <>
          <div className="card">
            <h2 style={{ marginBottom: 16 }}>
              {editando !== null ? t("almacenes.editar_almacen") : t("almacenes.nuevo_almacen")}
            </h2>

            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={t("almacenes.nombre_placeholder")}
            />

            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder={t("almacenes.descripcion_placeholder")}
              rows={2}
              style={{ marginTop: 10 }}
            />

            <div
              className="upload-box"
              style={{ marginTop: 10 }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) alSubirFoto(file);
              }}
            >
              {!fotoUrl ? (
                <>
                  <ImagePlus size={34} color="var(--text-muted)" />
                  <p>{subiendoFoto ? t("empresa.subiendo") : t("productos.subir_imagen")}</p>
                  <p className="upload-box-subtexto">{t("productos.subir_imagen_subtexto")}</p>
                </>
              ) : (
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fotoUrl} alt={nombre} className="upload-box-preview" />

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
                        setFotoUrl(null);
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
                if (file) alSubirFoto(file);
              }}
            />

            <div className="productos-toolbar" style={{ marginTop: 16 }}>
              <button onClick={guardar} className="btn-primary" disabled={guardando || subiendoFoto}>
                {guardando ? t("productos.guardando") : editando !== null ? t("productos.actualizar") : t("productos.guardar")}
              </button>

              {editando !== null && (
                <button onClick={limpiarFormulario} className="btn-delete">
                  {t("productos.cancelar")}
                </button>
              )}
            </div>
          </div>

          {almacenes.length === 0 ? (
            <div className="productos-vacio">
              <Warehouse size={26} color="var(--text-muted)" />
              <span>{t("almacenes.sin_almacenes")}</span>
            </div>
          ) : (
            <div className="almacenes-tarjetas">
              {almacenes.map((a) => {
                const expandido = almacenExpandidoId === a.id;
                const idDetalle = `almacen-detalle-${a.id}`;
                const productos = productosPorAlmacen.get(a.id) ?? [];

                return (
                  <div key={a.id} className="almacen-tarjeta">
                    {/* Botón real (no un div con role="button"), mismo
                        patrón accesible que la tarjeta de producto en
                        Productos — Editar/Eliminar quedan afuera, como
                        hermanos, para no anidar un botón dentro de otro. */}
                    <button
                      type="button"
                      className={`almacen-tarjeta-toggle${expandido ? " almacen-tarjeta-toggle-abierto" : ""}`}
                      onClick={() => setAlmacenExpandidoId((actual) => (actual === a.id ? null : a.id))}
                      aria-expanded={expandido}
                      aria-controls={idDetalle}
                      aria-label={t("almacenes.ver_productos")}
                    >
                      <div className="almacen-tarjeta-imagen">
                        {a.foto_url ? (
                          <Image src={a.foto_url} alt={a.nombre} fill sizes="220px" style={{ objectFit: "cover" }} />
                        ) : (
                          <MapPin size={26} color="var(--text-muted)" />
                        )}
                      </div>

                      <div className="almacen-tarjeta-cuerpo">
                        <p className="almacen-tarjeta-nombre">{a.nombre}</p>
                        <p className="almacen-tarjeta-descripcion">
                          {a.descripcion?.trim() ? a.descripcion : t("almacenes.sin_descripcion")}
                        </p>

                        <ChevronDown size={16} className="almacen-tarjeta-chevron" aria-hidden="true" />
                      </div>
                    </button>

                    {expandido && (
                      <div id={idDetalle} className="almacen-tarjeta-detalle">
                        <p className="almacen-tarjeta-detalle-titulo">{t("almacenes.productos_en_almacen")}</p>

                        {productos.length === 0 ? (
                          <p className="almacen-tarjeta-detalle-vacio">{t("almacenes.sin_productos")}</p>
                        ) : (
                          productos.map((p) => (
                            <div key={p.producto_id} className="almacen-tarjeta-detalle-fila">
                              <span>{p.nombre}</span>
                              <strong>{p.stock}</strong>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    <div className="productos-actions almacen-tarjeta-acciones">
                      <button onClick={() => editar(a)} className="btn-edit">
                        {t("productos.editar")}
                      </button>

                      <button onClick={() => eliminar(a.id)} className="btn-delete">
                        {t("productos.eliminar")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
