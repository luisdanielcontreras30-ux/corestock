"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Factory, Plus, BookOpen, Boxes, Calculator } from "lucide-react";
import { mensajeErrorSeguro } from "../../lib/errores";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import RequierePlus from "../../components/RequierePlus";
import { Producto, MateriaPrima, IngredienteReceta, Produccion } from "./types";
import { cargarDatos, crearMateriaPrima, eliminarMateriaPrima, agregarIngrediente, eliminarIngrediente } from "./acciones";
import CargandoLista from "../../components/CargandoLista";
import TableroTab from "./components/TableroTab";
import RecetasTab from "./components/RecetasTab";
import StockTab from "./components/StockTab";
import CotizacionTab from "./components/CotizacionTab";

export default function FabricacionPage() {
  return (
    <RequierePlus>
      <FabricacionContenido />
    </RequierePlus>
  );
}

function FabricacionContenido() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [recetas, setRecetas] = useState<IngredienteReceta[]>([]);
  const [producciones, setProducciones] = useState<Produccion[]>([]);

  const nombreMpRef = useRef<HTMLInputElement>(null);

  // Materias primas
  const [nombreMP, setNombreMP] = useState("");
  const [unidadMP, setUnidadMP] = useState("");
  const [stockMP, setStockMP] = useState("");
  const [costoMP, setCostoMP] = useState("");
  const [guardandoMP, setGuardandoMP] = useState(false);

  // Receta/producto seleccionado — un solo estado compartido entre
  // Producción y Recetas (antes cada uno tenía su propia lista
  // "Selecciona una receta", duplicada e independiente; ahora eligen
  // el mismo producto desde el mismo selector, arriba).
  const [productoSeleccionadoId, setProductoSeleccionadoId] = useState("");
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [materiaRecetaId, setMateriaRecetaId] = useState("");
  const [cantidadPorUnidad, setCantidadPorUnidad] = useState("");
  const [guardandoIngrediente, setGuardandoIngrediente] = useState(false);

  async function obtenerDatos() {
    setLoading(true);
    setError(false);
    try {
      const datos = await cargarDatos();
      setProductos(datos.productos);
      setMateriasPrimas(datos.materiasPrimas);
      setRecetas(datos.recetas);
      setProducciones(datos.producciones);
    } catch (error) {
      console.error(error);
      setError(true);
      mostrarToast(t("comun.msg_error_cargar_datos"), "error");
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

  function irACrearFabricacion() {
    // Con todo en una sola página, el campo ya está montado — no hace
    // falta esperar un frame extra como cuando vivía en otra pestaña.
    nombreMpRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    nombreMpRef.current?.focus();
  }

  async function guardarMateriaPrima() {
    if (guardandoMP) return;

    if (!nombreMP.trim()) {
      mostrarToast(t("fabricacion.msg_falta_nombre_mp"), "error");
      return;
    }

    const stockNum = stockMP === "" ? 0 : Number(stockMP);
    const costoNum = costoMP === "" ? 0 : Number(costoMP);

    if (!Number.isFinite(stockNum) || stockNum < 0 || !Number.isFinite(costoNum) || costoNum < 0) {
      mostrarToast(t("fabricacion.msg_datos_invalidos_mp"), "error");
      return;
    }

    try {
      setGuardandoMP(true);
      await crearMateriaPrima(nombreMP, unidadMP, stockNum, costoNum);
      setNombreMP("");
      setUnidadMP("");
      setStockMP("");
      setCostoMP("");
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle =
        error instanceof Error && error.message === "DATOS_INVALIDOS"
          ? t("fabricacion.msg_datos_invalidos_mp")
          : mensajeErrorSeguro(error);
      mostrarToast(detalle || t("fabricacion.msg_error_mp"), "error");
    } finally {
      setGuardandoMP(false);
    }
  }

  async function borrarMateriaPrima(id: number) {
    if (!(await confirmar(t("fabricacion.confirmar_eliminar_mp"), { peligroso: true }))) return;

    try {
      await eliminarMateriaPrima(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      mostrarToast(t("fabricacion.msg_error_eliminar_mp"), "error");
    }
  }

  async function guardarIngrediente() {
    if (guardandoIngrediente) return;

    const producto = productos.find((p) => p.id === Number(productoSeleccionadoId));
    const materiaPrima = materiasPrimas.find((m) => m.id === Number(materiaRecetaId));
    const cantidad = Number(cantidadPorUnidad);

    if (!producto || !materiaPrima) {
      mostrarToast(t("fabricacion.msg_falta_seleccion"), "error");
      return;
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      mostrarToast(t("fabricacion.msg_cantidad_invalida"), "error");
      return;
    }

    // Dos filas de receta con la misma materia prima hacen que el
    // chequeo de stock antes de producir compare cada una por
    // separado contra el mismo stock disponible, en vez de contra la
    // suma real que hace falta — puede reportar "alcanza" cuando en
    // realidad no alcanza.
    const recetaActual = recetas.filter((r) => r.producto_id === Number(productoSeleccionadoId));
    if (recetaActual.some((r) => r.materia_prima_id === materiaPrima.id)) {
      mostrarToast(t("fabricacion.msg_ingrediente_duplicado"), "error");
      return;
    }

    try {
      setGuardandoIngrediente(true);
      await agregarIngrediente(producto, materiaPrima, cantidad);
      setMateriaRecetaId("");
      setCantidadPorUnidad("");
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle =
        error instanceof Error && error.message === "CANTIDAD_INVALIDA"
          ? t("fabricacion.msg_cantidad_invalida")
          : mensajeErrorSeguro(error);
      mostrarToast(detalle || t("fabricacion.msg_error_receta"), "error");
    } finally {
      setGuardandoIngrediente(false);
    }
  }

  async function borrarIngrediente(id: number) {
    if (!(await confirmar(t("fabricacion.confirmar_eliminar_ingrediente"), { peligroso: true }))) return;

    try {
      await eliminarIngrediente(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      mostrarToast(t("fabricacion.msg_error_eliminar_receta"), "error");
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
        Icono={Factory}
        color="#ea580c"
        titulo={t("sidebar.fabricacion")}
        subtitulo={t("fabricacion.subtitulo")}
      />

      {loading ? (
        <CargandoLista />
      ) : error ? (
        <div className="card" style={{ textAlign: "center", padding: "50px 20px" }}>
          <p style={{ color: "#ef4444", marginBottom: 14 }}>{t("comun.msg_error_cargar_datos")}</p>
          <button className="btn-primary" onClick={obtenerDatos}>
            {t("empresa.reintentar")}
          </button>
        </div>
      ) : (
        <div className="fabricacion-secciones">
          {materiasPrimas.length === 0 && recetas.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(234, 88, 12, 0.12)",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 16px",
                }}
              >
                <Factory size={26} color="#ea580c" />
              </div>
              <h2 style={{ marginBottom: 8 }}>{t("fabricacion.vacio_titulo")}</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 13.5, maxWidth: 420, margin: "0 auto 20px" }}>
                {t("fabricacion.vacio_texto")}
              </p>
              <button
                className="btn-primary"
                onClick={irACrearFabricacion}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Plus size={16} /> {t("fabricacion.vacio_boton")}
              </button>
            </div>
          )}

          <section className="fabricacion-seccion">
            <div className="fabricacion-pasos">
              {[
                { titulo: t("fabricacion.paso1_titulo"), subtitulo: t("fabricacion.paso1_subtitulo") },
                { titulo: t("fabricacion.paso2_titulo"), subtitulo: t("fabricacion.paso2_subtitulo") },
                { titulo: t("fabricacion.paso3_titulo"), subtitulo: t("fabricacion.paso3_subtitulo") },
                { titulo: t("fabricacion.paso4_titulo"), subtitulo: t("fabricacion.paso4_subtitulo") },
              ].map((paso, i) => (
                <div key={paso.titulo} style={{ display: "contents" }}>
                  <div className="fabricacion-paso">
                    <div className={`fabricacion-paso-circulo ${i === 0 ? "fabricacion-paso-circulo-primero" : "fabricacion-paso-circulo-resto"}`}>
                      {i + 1}
                    </div>
                    <div className="fabricacion-paso-texto">
                      <span className="fabricacion-paso-titulo">{paso.titulo}</span>
                      <span className="fabricacion-paso-subtitulo">{paso.subtitulo}</span>
                    </div>
                  </div>
                  {i < 3 && <div className="fabricacion-paso-linea" />}
                </div>
              ))}
            </div>
            <TableroTab
              productos={productos}
              materiasPrimas={materiasPrimas}
              recetas={recetas}
              producciones={producciones}
              onProducido={obtenerDatos}
              productoSeleccionadoId={productoSeleccionadoId}
              onSeleccionarProducto={setProductoSeleccionadoId}
              busqueda={busquedaProducto}
              onCambiarBusqueda={setBusquedaProducto}
            />
          </section>

          <section className="fabricacion-seccion">
            <h2 className="fabricacion-seccion-titulo">
              <BookOpen size={17} /> {t("fabricacion.recetas")}
            </h2>
            <RecetasTab
              productos={productos}
              materiasPrimas={materiasPrimas}
              recetas={recetas}
              productoRecetaId={productoSeleccionadoId}
              materiaRecetaId={materiaRecetaId}
              onSeleccionarMateria={setMateriaRecetaId}
              cantidadPorUnidad={cantidadPorUnidad}
              onCambiarCantidad={setCantidadPorUnidad}
              guardandoIngrediente={guardandoIngrediente}
              onGuardarIngrediente={guardarIngrediente}
              onBorrarIngrediente={borrarIngrediente}
            />
          </section>

          <section className="fabricacion-seccion">
            <h2 className="fabricacion-seccion-titulo">
              <Boxes size={17} /> {t("fabricacion.materias_primas")}
            </h2>
            <StockTab
              materiasPrimas={materiasPrimas}
              nombreMpRef={nombreMpRef}
              nombreMP={nombreMP}
              onCambiarNombre={setNombreMP}
              unidadMP={unidadMP}
              onCambiarUnidad={setUnidadMP}
              stockMP={stockMP}
              onCambiarStock={setStockMP}
              costoMP={costoMP}
              onCambiarCosto={setCostoMP}
              guardandoMP={guardandoMP}
              onGuardar={guardarMateriaPrima}
              onBorrar={borrarMateriaPrima}
            />
          </section>

          <section className="fabricacion-seccion">
            <h2 className="fabricacion-seccion-titulo">
              <Calculator size={17} /> {t("fabricacion.cotizacion")}
            </h2>
            <CotizacionTab productos={productos} materiasPrimas={materiasPrimas} recetas={recetas} />
          </section>
        </div>
      )}
    </main>
  );
}
