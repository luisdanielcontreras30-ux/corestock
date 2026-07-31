"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Phone, Mail, Plus, Truck, History, Star, TrendingUp, TrendingDown, Minus, Wallet, CalendarClock} from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { obtenerNegocioId } from "../../lib/negocioActual";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import RequierePlus from "../../components/RequierePlus";
import HistorialModal from "./components/HistorialModal";
import { Proveedor, ProveedorConResumen, CompraProveedor } from "./types";
import {
  cargarProveedores,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
  cargarHistorialCompras,
} from "./acciones";
import CargandoLista from "../../components/CargandoLista";
import { formatoMoneda } from "../ventas/utils";
import { exportarExcel } from "./utils";

export default function ProveedoresPage() {
  return (
    <RequierePlus>
      <ProveedoresContenido />
    </RequierePlus>
  );
}

function ProveedoresContenido() {
  const { user } = useAuth();
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();

  const [proveedores, setProveedores] = useState<ProveedorConResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<ProveedorConResumen | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [proveedorHistorial, setProveedorHistorial] = useState<ProveedorConResumen | null>(null);
  const [comprasHistorial, setComprasHistorial] = useState<CompraProveedor[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  // Mismo guard que en Clientes: descarta la respuesta si ya se pidió
  // el historial de otro proveedor mientras esta seguía en camino.
  const idHistorialSolicitadoRef = useRef<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [notas, setNotas] = useState("");
  const [categoriaForm, setCategoriaForm] = useState("");
  const [calificacionForm, setCalificacionForm] = useState("");
  const [diasEntregaForm, setDiasEntregaForm] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");

  useEffect(() => {
    if (user) refrescar();
  }, [user]);

  async function refrescar() {
    if (!user) return;
    setCargando(true);
    setError(false);
    try {
      const negocioId = await obtenerNegocioId(user.id);
      const datos = await cargarProveedores(negocioId);
      setProveedores(datos);
    } catch (error) {
      console.error(error);
      setError(true);
      mostrarToast(t("comun.msg_error_cargar_datos"), "error");
    } finally {
      setCargando(false);
    }
  }

  function abrirNuevo() {
    setEditando(null);
    setNombre("");
    setTelefono("");
    setCorreo("");
    setNotas("");
    setMostrarForm(true);
    setCategoriaForm("");
    setCalificacionForm("");
    setDiasEntregaForm("");
  }

  function abrirEditar(p: ProveedorConResumen) {
    setEditando(p);
    setNombre(p.nombre);
    setTelefono(p.telefono ?? "");
    setCorreo(p.correo ?? "");
    setNotas(p.notas ?? "");
    setCategoriaForm(p.categoria ?? "");
    setCalificacionForm(p.calificacion != null ? String(p.calificacion) : "");
    setDiasEntregaForm(p.dias_entrega != null ? String(p.dias_entrega) : "");
    setMostrarForm(true);
  }

  async function verHistorial(p: ProveedorConResumen) {
    if (!user) return;

    idHistorialSolicitadoRef.current = p.id;
    setProveedorHistorial(p);
    setCargandoHistorial(true);

    try {
      const negocioId = await obtenerNegocioId(user.id);
      const datos = await cargarHistorialCompras(negocioId, p.id);
      if (idHistorialSolicitadoRef.current !== p.id) return;
      setComprasHistorial(datos);
    } catch (error) {
      if (idHistorialSolicitadoRef.current !== p.id) return;
      console.error(error);
      setComprasHistorial([]);
      mostrarToast(t("comun.msg_error_cargar_datos"), "error");
    } finally {
      if (idHistorialSolicitadoRef.current === p.id) {
        setCargandoHistorial(false);
      }
    }
  }

  async function guardar() {
    if (!user || guardando) return;

    if (!nombre.trim()) {
      mostrarToast(t("proveedores.msg_falta_nombre"), "error");
      return;
    }

    // Se valida ANTES de guardar y se avisa. Antes, un valor fuera de
    // rango simplemente no se mandaba: escribías 9 en la calificación,
    // guardabas, y el campo aparecía vacío al recargar sin que nadie te
    // dijera por qué. Descartar en silencio lo que alguien acaba de
    // escribir es peor que rechazarlo de frente.
    const calif = Number(calificacionForm);
    if (calificacionForm.trim() && (!Number.isFinite(calif) || calif < 1 || calif > 5)) {
      mostrarToast(t("proveedores.msg_calificacion_invalida"), "error");
      return;
    }

    const dias = Number(diasEntregaForm);
    if (diasEntregaForm.trim() && (!Number.isFinite(dias) || dias < 0 || dias > 365)) {
      mostrarToast(t("proveedores.msg_dias_invalidos"), "error");
      return;
    }

    setGuardando(true);

    try {
      const negocioId = await obtenerNegocioId(user.id);

      // Los tres campos del panel (categoría, calificación, días de
      // entrega) solo pueden viajar si sus columnas existen. Se detecta
      // mirando si la fila cargada TRAE la clave: la consulta usa
      // select("*"), así que la clave está presente —aunque valga null—
      // cuando la columna existe, y falta por completo cuando no.
      //
      // La distinción no es cosmética: si se omite el campo cuando está
      // vacío, borrar una categoría ya guardada es IMPOSIBLE (la
      // petición no la menciona, la base conserva el valor viejo, y al
      // recargar reaparece como si el guardado hubiera fallado). Cuando
      // las columnas existen se manda null explícito para poder vaciar.
      const columnasDelPanel = editando ? "categoria" in editando : false;

      // Ya validados arriba: aquí solo se distingue "hay valor" de "está
      // vacío", que es lo que decide entre guardar el número o null.
      const hayCalificacion = !!calificacionForm.trim();
      const hayDias = !!diasEntregaForm.trim();

      const extras: Partial<Proveedor> = {};

      if (columnasDelPanel) {
        extras.categoria = categoriaForm.trim() || null;
        extras.calificacion = hayCalificacion ? Math.round(calif) : null;
        extras.dias_entrega = hayDias ? Math.round(dias) : null;
      } else {
        // Sin migración (o dando de alta uno nuevo, donde omitir un
        // campo vacío es idéntico a mandar null): solo lo que se llenó.
        if (categoriaForm.trim()) extras.categoria = categoriaForm.trim();
        if (hayCalificacion) extras.calificacion = Math.round(calif);
        if (hayDias) extras.dias_entrega = Math.round(dias);
      }

      if (editando) {
        await actualizarProveedor(negocioId, editando.id, {
          nombre: nombre.trim(),
          telefono: telefono.trim() || null,
          correo: correo.trim() || null,
          notas: notas.trim() || null,
          ...extras,
        });
      } else {
        await crearProveedor(negocioId, nombre, telefono, correo, notas, extras);
      }

      setMostrarForm(false);
      await refrescar();
    } catch (error) {
      console.error(error);
      // Si faltan las columnas nuevas, Postgres lo dice con claridad y
      // no tiene sentido esconderlo tras un "no se pudo guardar": la
      // solución es correr un archivo SQL, y hay que decirlo.
      const texto = error instanceof Error ? error.message : "";

      // Sentinels de acciones.ts (sin traducir a propósito, ver
      // lib/errores.ts): se convierten aquí al idioma de la app.
      if (texto === "CALIFICACION_INVALIDA") {
        mostrarToast(t("proveedores.msg_calificacion_invalida"), "error");
        return;
      }
      if (texto === "DIAS_INVALIDOS") {
        mostrarToast(t("proveedores.msg_dias_invalidos"), "error");
        return;
      }

      const faltaMigracion = /column .* does not exist|categoria|calificacion|dias_entrega/i.test(texto);
      mostrarToast(
        t(faltaMigracion ? "proveedores.msg_falta_migracion" : "proveedores.msg_error_guardar"),
        "error"
      );
    } finally {
      setGuardando(false);
    }
  }

  async function alEliminar(p: ProveedorConResumen) {
    if (!user) return;

    if (!(await confirmar(t("proveedores.confirmar_eliminar").replace("{nombre}", p.nombre), { peligroso: true }))) {
      return;
    }

    try {
      const negocioId = await obtenerNegocioId(user.id);
      await eliminarProveedor(negocioId, p.id);
      await refrescar();
    } catch (error: unknown) {
      console.error(error);

      const codigo = error && typeof error === "object" && "code" in error ? error.code : null;

      if (codigo === "23503") {
        mostrarToast(t("proveedores.msg_error_fk"), "error");
      } else {
        mostrarToast(t("proveedores.msg_error_eliminar"), "error");
      }
    }
  }

  // Categorías reales del propio listado: aparecen y desaparecen solas.
  // Si nadie ha corrido la migración, `categoria` no viene en la
  // consulta (usa select *), el arreglo sale vacío y la fila de filtros
  // ni se dibuja — la pantalla funciona igual sin ella.
  const categorias = useMemo(() => {
    const vistas = new Set<string>();
    for (const p of proveedores) {
      const c = p.categoria?.trim();
      if (c) vistas.add(c);
    }
    return [...vistas].sort((a, b) => a.localeCompare(b));
  }, [proveedores]);

  const categoriaActiva = categoria && categorias.includes(categoria) ? categoria : "";

  // Cifras de la tira superior. Todas salen de lo ya cargado.
  const global = useMemo(() => {
    const gastoTotal = proveedores.reduce((s, p) => s + p.totalGastado, 0);
    const calificados = proveedores.filter((p) => typeof p.calificacion === "number");
    const promedio =
      calificados.length > 0
        ? calificados.reduce((s, p) => s + (p.calificacion ?? 0), 0) / calificados.length
        : null;
    return { gastoTotal, promedio, calificados: calificados.length };
  }, [proveedores]);

  const proveedoresFiltrados = useMemo(
    () =>
      proveedores.filter((p) => {
        if (categoriaActiva && (p.categoria?.trim() || "") !== categoriaActiva) return false;
        return p.nombre.toLowerCase().includes(busqueda.toLowerCase().trim());
      }),
    [proveedores, busqueda, categoriaActiva]
  );

  return (
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <EncabezadoModulo
          Icono={Truck}
          color="#b45309"
          titulo={t("proveedores.titulo")}
          subtitulo={t("proveedores.subtitulo")}
        />

        <button className="btn-primary" onClick={abrirNuevo} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={16} /> {t("proveedores.agregar")}
        </button>
      </div>

      {!cargando && !error && proveedores.length > 0 && (
        <>
          <div className="modulo-resumen">
            <div className="modulo-resumen-item">
              <span className="modulo-resumen-icono">
                <Truck size={17} />
              </span>
              <div>
                <span className="modulo-resumen-valor">{proveedores.length}</span>
                <span className="modulo-resumen-etiqueta">{t("proveedores.resumen_total")}</span>
              </div>
            </div>
            <div className="modulo-resumen-item">
              <span className="modulo-resumen-icono">
                <Wallet size={17} />
              </span>
              <div>
                <span className="modulo-resumen-valor">{formatoMoneda(global.gastoTotal)}</span>
                <span className="modulo-resumen-etiqueta">{t("proveedores.resumen_gasto")}</span>
              </div>
            </div>
            {/* Solo si alguien ha calificado a alguien: un "0.0 de
                promedio" cuando nadie ha puntuado nada parece una mala
                nota, no un dato ausente. */}
            {global.promedio !== null && (
              <div className="modulo-resumen-item">
                <span className="modulo-resumen-icono">
                  <Star size={17} />
                </span>
                <div>
                  <span className="modulo-resumen-valor">{global.promedio.toFixed(1)}</span>
                  <span className="modulo-resumen-etiqueta">{t("proveedores.resumen_calificacion")}</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <input
              style={{ flex: 1, minWidth: 220 }}
              placeholder={t("proveedores.buscar")}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />

            {proveedores.length > 0 && (
              <button className="btn-secondary" onClick={() => exportarExcel(proveedoresFiltrados)}>
                {t("productos.exportar_excel")}
              </button>
            )}
          </div>

          {categorias.length > 0 && (
            <div className="chips-filtro">
              <button
                type="button"
                className={`chip-filtro ${categoriaActiva === "" ? "chip-filtro-activo" : ""}`}
                onClick={() => setCategoria("")}
                aria-pressed={categoriaActiva === ""}
              >
                {t("ventas_rapidas.categoria_todos")}
              </button>
              {categorias.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`chip-filtro ${categoriaActiva === c ? "chip-filtro-activo" : ""}`}
                  onClick={() => setCategoria(c)}
                  aria-pressed={categoriaActiva === c}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {cargando ? (
        <CargandoLista />
      ) : error ? (
        <div className="card" style={{ textAlign: "center", padding: "50px 20px" }}>
          <p style={{ color: "#ef4444", marginBottom: 14 }}>{t("comun.msg_error_cargar_datos")}</p>
          <button className="btn-primary" onClick={refrescar}>
            {t("empresa.reintentar")}
          </button>
        </div>
      ) : proveedores.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "50px 20px" }}>
          <p style={{ color: "var(--text-secondary)" }}>{t("proveedores.sin_proveedores")}</p>
        </div>
      ) : proveedoresFiltrados.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "50px 20px" }}>
          <p style={{ color: "var(--text-secondary)" }}>{t("proveedores.sin_resultados_busqueda")}</p>
        </div>
      ) : (
        <div className="proveedores-rejilla">
          {proveedoresFiltrados.map((p) => {
            const participacion =
              global.gastoTotal > 0 ? (p.totalGastado / global.gastoTotal) * 100 : 0;

            // Tendencia real: lo comprado en los últimos 30 días contra
            // los 30 anteriores. Se marca "igual" cuando la diferencia
            // es menor al 5% para que un cambio de unos pesos no
            // aparezca como una subida.
            const variacion = p.gastoReciente - p.gastoAnterior;
            const base = Math.max(p.gastoAnterior, 1);
            const tendencia =
              Math.abs(variacion) / base < 0.05 ? "igual" : variacion > 0 ? "sube" : "baja";

            return (
              <div key={p.id} className="prov-tarjeta">
                <div className="prov-cabecera">
                  <span className="prov-avatar">{p.nombre.trim().charAt(0).toUpperCase() || "?"}</span>

                  <div className="prov-identidad">
                    <h3 className="prov-nombre">{p.nombre}</h3>
                    {typeof p.calificacion === "number" ? (
                      <span className="prov-estrellas" title={`${p.calificacion} / 5`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            size={13}
                            fill={n <= (p.calificacion ?? 0) ? "currentColor" : "none"}
                          />
                        ))}
                        <span className="prov-estrellas-texto">{p.calificacion} / 5</span>
                      </span>
                    ) : (
                      <span className="prov-sin-calificar">{t("proveedores.sin_calificar")}</span>
                    )}
                  </div>

                  {p.categoria?.trim() && <span className="prov-categoria">{p.categoria.trim()}</span>}
                </div>

                <div className="prov-metricas">
                  <div>
                    <span className="prov-metrica-valor">{formatoMoneda(p.totalGastado)}</span>
                    <span className="prov-metrica-etiqueta">{t("proveedores.total_gastado")}</span>
                  </div>
                  <div>
                    <span className="prov-metrica-valor">{p.compras}</span>
                    <span className="prov-metrica-etiqueta">{t("proveedores.compras_totales")}</span>
                  </div>
                  <div>
                    <span className="prov-metrica-valor">
                      {typeof p.dias_entrega === "number" ? `${p.dias_entrega}d` : "—"}
                    </span>
                    <span className="prov-metrica-etiqueta">{t("proveedores.dias_entrega")}</span>
                  </div>
                </div>

                {/* Cuánto del gasto total del negocio se va con este
                    proveedor. Dice de un vistazo de quién se depende. */}
                <div className="prov-barra-fila">
                  <span>{t("proveedores.participacion")}</span>
                  <span className="prov-barra-valor">{participacion.toFixed(0)}%</span>
                </div>
                <div className="prov-barra">
                  <span style={{ width: `${Math.min(100, participacion)}%` }} />
                </div>

                <div className="prov-pie">
                  <span className={`prov-tendencia prov-tendencia-${tendencia}`}>
                    {tendencia === "sube" ? (
                      <TrendingUp size={14} />
                    ) : tendencia === "baja" ? (
                      <TrendingDown size={14} />
                    ) : (
                      <Minus size={14} />
                    )}
                    {t(`proveedores.tendencia_${tendencia}`)}
                  </span>

                  <span className="prov-ultima">
                    <CalendarClock size={13} />
                    {p.ultimaCompra
                      ? new Date(p.ultimaCompra).toLocaleDateString()
                      : t("proveedores.sin_compras")}
                  </span>
                </div>

                {(p.telefono || p.correo || p.notas) && (
                  <div className="prov-contacto">
                    {p.telefono && <span>{p.telefono}</span>}
                    {p.correo && <span>{p.correo}</span>}
                    {p.notas && <span className="prov-notas">{p.notas}</span>}
                  </div>
                )}

                <div className="prov-acciones">
                  {p.telefono && (
                    <a href={`tel:${p.telefono}`} className="btn-secondary prov-accion">
                      <Phone size={14} /> {t("proveedores.llamar")}
                    </a>
                  )}
                  {p.correo && (
                    <a href={`mailto:${p.correo}`} className="btn-secondary prov-accion">
                      <Mail size={14} /> {t("proveedores.correo")}
                    </a>
                  )}
                  <button className="btn-secondary prov-accion" onClick={() => verHistorial(p)}>
                    <History size={14} /> {t("proveedores.ver_historial")}
                  </button>
                  <button className="btn-edit prov-accion" onClick={() => abrirEditar(p)}>
                    {t("proveedores.editar")}
                  </button>
                  <button className="btn-delete prov-accion" onClick={() => alEliminar(p)}>
                    {t("proveedores.eliminar")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mostrarForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "40px 20px",
            overflowY: "auto",
            zIndex: 600,
          }}
          onClick={() => setMostrarForm(false)}
        >
          <div
            className="card fade-up"
            style={{
              width: "100%",
              maxWidth: 460,
              maxHeight: "min(640px, calc(100vh - 80px))",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: 20, flexShrink: 0 }}>
              {editando ? t("proveedores.editar_proveedor") : t("proveedores.nuevo_proveedor")}
            </h2>

            {/* Con calificación + días de entrega + categoría, el
                formulario ya no cabe completo en pantallas cortas — sin
                límite de alto, el título aparecía arriba y el botón
                Guardar quedaba fuera de la vista, sin ninguna señal de
                que hubiera más campos abajo. Ahora solo esta zona
                intermedia scrollea: el título y los botones de Cancelar
                / Guardar quedan siempre visibles. */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                overflowY: "auto",
                minHeight: 0,
                paddingRight: 4,
              }}
            >
              <div>
                <label>{t("proveedores.nombre")}</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Distribuidora ABC" />
              </div>

              <div>
                <label>{t("proveedores.telefono")}</label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+52 55 1234 5678"
                />
              </div>

              <div>
                <label>{t("proveedores.correo")}</label>
                <input
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="contacto@proveedor.com"
                />
              </div>

              {/* Los tres del panel. Si no se ha corrido
                  supabase_proveedores_scorecard.sql, dejarlos vacíos
                  hace que la petición ni los mencione y todo sigue
                  funcionando igual que antes. */}
              <div>
                <label>{t("proveedores.categoria")}</label>
                <input
                  value={categoriaForm}
                  onChange={(e) => setCategoriaForm(e.target.value)}
                  placeholder={t("proveedores.categoria_placeholder")}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label>{t("proveedores.calificacion")}</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="1"
                    value={calificacionForm}
                    onChange={(e) => setCalificacionForm(e.target.value)}
                    placeholder="1 - 5"
                  />
                </div>
                <div>
                  <label>{t("proveedores.dias_entrega")}</label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    step="1"
                    value={diasEntregaForm}
                    onChange={(e) => setDiasEntregaForm(e.target.value)}
                    placeholder={t("proveedores.dias_entrega_placeholder")}
                  />
                </div>
              </div>

              <div>
                <label>{t("proveedores.notas")}</label>
                <input
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder={t("proveedores.notas_placeholder")}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 22,
                flexShrink: 0,
              }}
            >
              <button className="btn-secondary" onClick={() => setMostrarForm(false)}>
                {t("usuarios.cancelar")}
              </button>
              <button className="btn-primary" onClick={guardar} disabled={guardando}>
                {guardando ? t("proveedores.guardando") : t("usuarios.guardar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {proveedorHistorial && (
        <HistorialModal
          proveedor={proveedorHistorial}
          compras={comprasHistorial}
          cargando={cargandoHistorial}
          onClose={() => setProveedorHistorial(null)}
        />
      )}
    </main>
  );
}
