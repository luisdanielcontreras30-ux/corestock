"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Factory, Trash2, PackagePlus } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import { Producto, MateriaPrima, IngredienteReceta, Produccion } from "./types";
import {
  cargarDatos,
  crearMateriaPrima,
  eliminarMateriaPrima,
  agregarIngrediente,
  eliminarIngrediente,
  producir,
} from "./acciones";

export default function FabricacionPage() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();

  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [recetas, setRecetas] = useState<IngredienteReceta[]>([]);
  const [producciones, setProducciones] = useState<Produccion[]>([]);

  // Materias primas
  const [nombreMP, setNombreMP] = useState("");
  const [unidadMP, setUnidadMP] = useState("");
  const [stockMP, setStockMP] = useState("");
  const [costoMP, setCostoMP] = useState("");
  const [guardandoMP, setGuardandoMP] = useState(false);

  // Recetas
  const [productoRecetaId, setProductoRecetaId] = useState("");
  const [materiaRecetaId, setMateriaRecetaId] = useState("");
  const [cantidadPorUnidad, setCantidadPorUnidad] = useState("");
  const [guardandoIngrediente, setGuardandoIngrediente] = useState(false);

  // Producir
  const [productoProducirId, setProductoProducirId] = useState("");
  const [cantidadAProducir, setCantidadAProducir] = useState("");
  const [produciendo, setProduciendo] = useState(false);

  async function obtenerDatos() {
    setLoading(true);
    try {
      const datos = await cargarDatos();
      setProductos(datos.productos);
      setMateriasPrimas(datos.materiasPrimas);
      setRecetas(datos.recetas);
      setProducciones(datos.producciones);
    } catch (error) {
      console.error(error);
      alert(t("comun.msg_error_cargar_datos"));
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

  async function guardarMateriaPrima() {
    if (guardandoMP) return;

    if (!nombreMP.trim()) {
      alert(t("fabricacion.msg_falta_nombre_mp"));
      return;
    }

    const stockNum = Number(stockMP) || 0;
    const costoNum = Number(costoMP) || 0;

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
      alert(t("fabricacion.msg_error_mp"));
    } finally {
      setGuardandoMP(false);
    }
  }

  async function borrarMateriaPrima(id: number) {
    if (!confirm(t("fabricacion.confirmar_eliminar_mp"))) return;

    try {
      await eliminarMateriaPrima(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(t("fabricacion.msg_error_eliminar_mp"));
    }
  }

  const recetaSeleccionada = recetas.filter(
    (r) => r.producto_id === Number(productoRecetaId)
  );

  async function guardarIngrediente() {
    if (guardandoIngrediente) return;

    const producto = productos.find((p) => p.id === Number(productoRecetaId));
    const materiaPrima = materiasPrimas.find((m) => m.id === Number(materiaRecetaId));
    const cantidad = Number(cantidadPorUnidad);

    if (!producto || !materiaPrima) {
      alert(t("fabricacion.msg_falta_seleccion"));
      return;
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      alert(t("fabricacion.msg_cantidad_invalida"));
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
      alert(t("fabricacion.msg_error_receta"));
    } finally {
      setGuardandoIngrediente(false);
    }
  }

  async function borrarIngrediente(id: number) {
    try {
      await eliminarIngrediente(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(t("fabricacion.msg_error_eliminar_receta"));
    }
  }

  const productosConReceta = productos.filter((p) =>
    recetas.some((r) => r.producto_id === p.id)
  );

  const ingredientesAProducir = recetas.filter(
    (r) => r.producto_id === Number(productoProducirId)
  );

  const cantidadProducirNum = Number(cantidadAProducir) || 0;

  async function alProducir() {
    if (produciendo) return;

    const producto = productos.find((p) => p.id === Number(productoProducirId));

    if (!producto) {
      alert(t("fabricacion.msg_selecciona_producto"));
      return;
    }

    if (!Number.isFinite(cantidadProducirNum) || cantidadProducirNum <= 0) {
      alert(t("fabricacion.msg_cantidad_invalida"));
      return;
    }

    try {
      setProduciendo(true);
      await producir(producto, cantidadProducirNum, ingredientesAProducir);
      setProductoProducirId("");
      setCantidadAProducir("");
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      const detalle = error instanceof Error ? error.message : "";
      alert(detalle || t("fabricacion.msg_error_producir"));
    } finally {
      setProduciendo(false);
    }
  }

  if (cargandoAuth || !user || loading) {
    return (
      <main className="fade-up">
        <div className="card">{t("header.cargando")}</div>
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

      {/* MATERIAS PRIMAS */}
      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{t("fabricacion.materias_primas")}</h2>

        <div className="productos-grid">
          <input
            value={nombreMP}
            onChange={(e) => setNombreMP(e.target.value)}
            placeholder={t("fabricacion.nombre_mp_placeholder")}
          />
          <input
            value={unidadMP}
            onChange={(e) => setUnidadMP(e.target.value)}
            placeholder={t("fabricacion.unidad_placeholder")}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={stockMP}
            onChange={(e) => setStockMP(e.target.value)}
            placeholder={t("fabricacion.stock_inicial")}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={costoMP}
            onChange={(e) => setCostoMP(e.target.value)}
            placeholder={t("compras.costo_unitario")}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn-primary" onClick={guardarMateriaPrima} disabled={guardandoMP}>
            {guardandoMP ? t("compras.guardando") : t("fabricacion.agregar_mp")}
          </button>
        </div>

        {materiasPrimas.length > 0 && (
          <div className="tabla" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>{t("promociones.col_nombre")}</th>
                  <th>{t("fabricacion.col_unidad")}</th>
                  <th>{t("dashboard.stock_actual")}</th>
                  <th>{t("compras.costo_unitario")}</th>
                  <th>{t("productos.col_acciones")}</th>
                </tr>
              </thead>
              <tbody>
                {materiasPrimas.map((m) => (
                  <tr key={m.id}>
                    <td>{m.nombre}</td>
                    <td>{m.unidad}</td>
                    <td>{m.stock}</td>
                    <td>${Number(m.costo_unitario).toFixed(2)}</td>
                    <td>
                      <button
                        className="btn-delete"
                        aria-label={t("productos.eliminar")}
                        onClick={() => borrarMateriaPrima(m.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECETAS */}
      <div className="card">
        <h2 style={{ marginBottom: 6 }}>{t("fabricacion.recetas")}</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
          {t("fabricacion.recetas_desc")}
        </p>

        <select value={productoRecetaId} onChange={(e) => setProductoRecetaId(e.target.value)}>
          <option value="">{t("fabricacion.selecciona_producto")}</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>

        {productoRecetaId && (
          <>
            <div className="productos-grid" style={{ marginTop: 12 }}>
              <select value={materiaRecetaId} onChange={(e) => setMateriaRecetaId(e.target.value)}>
                <option value="">{t("fabricacion.selecciona_materia_prima")}</option>
                {materiasPrimas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} ({m.unidad})
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={cantidadPorUnidad}
                onChange={(e) => setCantidadPorUnidad(e.target.value)}
                placeholder={t("fabricacion.cantidad_por_unidad")}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button
                className="btn-secondary"
                onClick={guardarIngrediente}
                disabled={guardandoIngrediente}
              >
                {t("fabricacion.agregar_ingrediente")}
              </button>
            </div>

            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {recetaSeleccionada.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                  {t("fabricacion.sin_receta")}
                </p>
              ) : (
                recetaSeleccionada.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                    }}
                  >
                    <span style={{ fontSize: 13.5 }}>
                      {r.cantidad_por_unidad} × {r.materia_prima_nombre}
                    </span>
                    <button className="btn-delete" onClick={() => borrarIngrediente(r.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* PRODUCIR */}
      <div className="card">
        <h2 style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <PackagePlus size={18} /> {t("fabricacion.producir")}
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
          {t("fabricacion.producir_desc")}
        </p>

        <div className="productos-grid">
          <select value={productoProducirId} onChange={(e) => setProductoProducirId(e.target.value)}>
            <option value="">{t("fabricacion.selecciona_producto_con_receta")}</option>
            {productosConReceta.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="1"
            step="1"
            value={cantidadAProducir}
            onChange={(e) => setCantidadAProducir(e.target.value)}
            placeholder={t("fabricacion.cantidad_a_producir")}
          />
        </div>

        {productoProducirId && cantidadProducirNum > 0 && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {ingredientesAProducir.map((ing) => {
              const materiaPrima = materiasPrimas.find((m) => m.id === ing.materia_prima_id);
              const necesario = ing.cantidad_por_unidad * cantidadProducirNum;
              const disponible = materiaPrima?.stock ?? 0;
              const alcanza = disponible >= necesario;

              return (
                <div
                  key={ing.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12.5,
                    color: alcanza ? "var(--text-secondary)" : "#ef4444",
                  }}
                >
                  <span>{ing.materia_prima_nombre}</span>
                  <span>
                    {necesario} / {disponible} {materiaPrima?.unidad}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn-primary" onClick={alProducir} disabled={produciendo}>
            {produciendo ? t("compras.guardando") : t("fabricacion.producir")}
          </button>
        </div>
      </div>

      {/* HISTORIAL DE PRODUCCIONES */}
      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>{t("tabla.fecha")}</th>
              <th>{t("tabla.producto")}</th>
              <th>{t("tabla.cantidad")}</th>
            </tr>
          </thead>
          <tbody>
            {producciones.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  {t("fabricacion.sin_producciones")}
                </td>
              </tr>
            ) : (
              producciones.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.fecha).toLocaleString()}</td>
                  <td>{p.producto_nombre}</td>
                  <td>{p.cantidad}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
