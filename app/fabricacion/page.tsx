"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Factory, Plus } from "lucide-react";
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
import FabricacionTabs, { TabFabricacion } from "./components/FabricacionTabs";
import TableroTab from "./components/TableroTab";
import RecetasTab from "./components/RecetasTab";
import AsistenteProduccion from "./components/AsistenteProduccion";
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

  const [tab, setTab] = useState<TabFabricacion>("tablero");
  const nombreMpRef = useRef<HTMLInputElement>(null);

  // Materias primas (pestaña Stock) — se queda en la página porque el
  // estado vacío de abajo necesita enfocar el campo al cambiar de
  // pestaña.
  const [nombreMP, setNombreMP] = useState("");
  const [unidadMP, setUnidadMP] = useState("");
  const [stockMP, setStockMP] = useState("");
  const [costoMP, setCostoMP] = useState("");
  const [guardandoMP, setGuardandoMP] = useState(false);

  // Recetas (pestaña Recetas)
  const [productoRecetaId, setProductoRecetaId] = useState("");
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
    setTab("stock");
    // El campo vive en otra pestaña — hay que esperar a que se monte
    // antes de poder enfocarlo.
    requestAnimationFrame(() => {
      nombreMpRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      nombreMpRef.current?.focus();
    });
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

    const producto = productos.find((p) => p.id === Number(productoRecetaId));
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
    const recetaActual = recetas.filter((r) => r.producto_id === Number(productoRecetaId));
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
        <>
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

          <FabricacionTabs activa={tab} onCambiar={setTab} />

          {tab === "tablero" && (
            <TableroTab materiasPrimas={materiasPrimas} producciones={producciones} totalRecetas={recetas.length} />
          )}

          {tab === "recetas" && (
            <RecetasTab
              productos={productos}
              materiasPrimas={materiasPrimas}
              recetas={recetas}
              productoRecetaId={productoRecetaId}
              onSeleccionarProducto={setProductoRecetaId}
              materiaRecetaId={materiaRecetaId}
              onSeleccionarMateria={setMateriaRecetaId}
              cantidadPorUnidad={cantidadPorUnidad}
              onCambiarCantidad={setCantidadPorUnidad}
              guardandoIngrediente={guardandoIngrediente}
              onGuardarIngrediente={guardarIngrediente}
              onBorrarIngrediente={borrarIngrediente}
            />
          )}

          {tab === "produccion" && (
            <AsistenteProduccion
              productos={productos}
              materiasPrimas={materiasPrimas}
              recetas={recetas}
              onProducido={obtenerDatos}
            />
          )}

          {tab === "stock" && (
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
          )}

          {tab === "cotizacion" && (
            <CotizacionTab productos={productos} materiasPrimas={materiasPrimas} recetas={recetas} />
          )}
        </>
      )}
    </main>
  );
}
