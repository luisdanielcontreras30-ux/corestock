"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Phone, Mail, Plus, Users, History, Star, Wallet } from "lucide-react";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import HistorialModal from "./components/HistorialModal";
import { Cliente, ClienteConResumen, CompraCliente } from "./types";
import {
  cargarClientes,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
  cargarHistorialCompras,
} from "./acciones";
import CargandoLista from "../../components/CargandoLista";
import { formatoMoneda } from "../ventas/utils";
import { exportarExcel } from "./utils";

export default function ClientesPage() {
  const { t } = useIdioma();
  const { mostrarToast } = useToast();
  const { confirmar } = useConfirm();

  const [clientes, setClientes] = useState<ClienteConResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<ClienteConResumen | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [clienteHistorial, setClienteHistorial] = useState<ClienteConResumen | null>(null);
  const [comprasHistorial, setComprasHistorial] = useState<CompraCliente[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  // Descarta la respuesta si ya se pidió el historial de otro cliente
  // mientras esta seguía en camino.
  const idHistorialSolicitadoRef = useRef<number | null>(null);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [notas, setNotas] = useState("");
  const [categoriaForm, setCategoriaForm] = useState("");
  const [calificacionForm, setCalificacionForm] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");

  useEffect(() => {
    refrescar();
  }, []);

  async function refrescar() {
    setCargando(true);
    setError(false);
    try {
      const { clientes: clientesCargados } = await cargarClientes();
      setClientes(clientesCargados);
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
    setCategoriaForm("");
    setCalificacionForm("");
    setMostrarForm(true);
  }

  function abrirEditar(c: ClienteConResumen) {
    setEditando(c);
    setNombre(c.nombre);
    setTelefono(c.telefono ?? "");
    setCorreo(c.correo ?? "");
    setNotas(c.notas ?? "");
    setCategoriaForm(c.categoria ?? "");
    setCalificacionForm(c.calificacion != null ? String(c.calificacion) : "");
    setMostrarForm(true);
  }

  async function verHistorial(c: ClienteConResumen) {
    idHistorialSolicitadoRef.current = c.id;
    setClienteHistorial(c);
    setCargandoHistorial(true);

    try {
      const datos = await cargarHistorialCompras(c.id);
      if (idHistorialSolicitadoRef.current !== c.id) return;
      setComprasHistorial(datos);
    } catch (error) {
      if (idHistorialSolicitadoRef.current !== c.id) return;
      console.error(error);
      setComprasHistorial([]);
      mostrarToast(t("comun.msg_error_cargar_datos"), "error");
    } finally {
      if (idHistorialSolicitadoRef.current === c.id) {
        setCargandoHistorial(false);
      }
    }
  }

  async function guardar() {
    if (guardando) return;

    if (!nombre.trim()) {
      mostrarToast(t("clientes.msg_nombre_requerido"), "error");
      return;
    }

    // Se valida ANTES de guardar y se avisa. Descartar en silencio lo
    // que alguien acaba de escribir es peor que rechazarlo de frente.
    const calif = Number(calificacionForm);
    if (calificacionForm.trim() && (!Number.isFinite(calif) || calif < 1 || calif > 5)) {
      mostrarToast(t("clientes.msg_calificacion_invalida"), "error");
      return;
    }

    setGuardando(true);

    try {
      // Categoría y calificación solo pueden viajar si sus columnas
      // existen. Se detecta mirando si la fila cargada TRAE la clave:
      // la consulta usa select("*"), así que la clave está presente
      // —aunque valga null— cuando la columna existe, y falta por
      // completo cuando no.
      //
      // La distinción no es cosmética: si se omite el campo cuando está
      // vacío, borrar una categoría ya guardada es IMPOSIBLE (la
      // petición no la menciona, la base conserva el valor viejo, y al
      // recargar reaparece como si el guardado hubiera fallado). Cuando
      // las columnas existen se manda null explícito para poder vaciar.
      const columnasDelPanel = editando ? "categoria" in editando : false;
      const hayCalificacion = !!calificacionForm.trim();

      const extras: Partial<Cliente> = {};

      if (columnasDelPanel) {
        extras.categoria = categoriaForm.trim() || null;
        extras.calificacion = hayCalificacion ? Math.round(calif) : null;
      } else {
        // Sin migración (o dando de alta uno nuevo, donde omitir un
        // campo vacío es idéntico a mandar null): solo lo que se llenó.
        if (categoriaForm.trim()) extras.categoria = categoriaForm.trim();
        if (hayCalificacion) extras.calificacion = Math.round(calif);
      }

      if (editando) {
        await actualizarCliente(editando.id, {
          nombre: nombre.trim(),
          telefono: telefono.trim() || null,
          correo: correo.trim() || null,
          notas: notas.trim() || null,
          ...extras,
        });
      } else {
        await crearCliente(nombre, telefono, correo, notas, extras);
      }

      setMostrarForm(false);
      await refrescar();
    } catch (error) {
      console.error(error);
      const texto = error instanceof Error ? error.message : "";

      // Sentinel de acciones.ts (sin traducir a propósito, ver
      // lib/errores.ts): se convierte aquí al idioma de la app.
      if (texto === "CALIFICACION_INVALIDA") {
        mostrarToast(t("clientes.msg_calificacion_invalida"), "error");
        return;
      }

      // Si falta la columna nueva, Postgres lo dice con claridad y no
      // tiene sentido esconderlo tras un "no se pudo guardar": la
      // solución es correr un archivo SQL, y hay que decirlo.
      const faltaMigracion = /column .* does not exist|categoria|calificacion/i.test(texto);
      mostrarToast(
        t(faltaMigracion ? "clientes.msg_falta_migracion" : "clientes.msg_error_guardar"),
        "error"
      );
    } finally {
      setGuardando(false);
    }
  }

  async function alEliminar(c: ClienteConResumen) {
    if (!(await confirmar(t("clientes.confirmar_eliminar").replace("{nombre}", c.nombre), { peligroso: true }))) {
      return;
    }

    try {
      await eliminarCliente(c.id);
      await refrescar();
    } catch (error: unknown) {
      console.error(error);

      const codigo = error && typeof error === "object" && "code" in error ? error.code : null;

      if (codigo === "23503") {
        mostrarToast(t("clientes.msg_error_fk"), "error");
      } else {
        mostrarToast(t("clientes.msg_error_eliminar"), "error");
      }
    }
  }

  // Categorías reales del propio listado: aparecen y desaparecen solas.
  // Si nadie ha corrido la migración, `categoria` no viene en la
  // consulta (usa select *), el arreglo sale vacío y la fila de filtros
  // ni se dibuja — la pantalla funciona igual sin ella.
  const categorias = useMemo(() => {
    const vistas = new Set<string>();
    for (const c of clientes) {
      const cat = c.categoria?.trim();
      if (cat) vistas.add(cat);
    }
    return [...vistas].sort((a, b) => a.localeCompare(b));
  }, [clientes]);

  const categoriaActiva = categoria && categorias.includes(categoria) ? categoria : "";

  // Cifras de la tira superior. Todas salen de lo ya cargado.
  const global = useMemo(() => {
    const gastoTotal = clientes.reduce((s, c) => s + c.totalGastado, 0);
    const calificados = clientes.filter((c) => typeof c.calificacion === "number");
    const promedio =
      calificados.length > 0
        ? calificados.reduce((s, c) => s + (c.calificacion ?? 0), 0) / calificados.length
        : null;
    return { gastoTotal, promedio };
  }, [clientes]);

  const clientesFiltrados = useMemo(
    () =>
      clientes.filter((c) => {
        if (categoriaActiva && (c.categoria?.trim() || "") !== categoriaActiva) return false;
        return c.nombre.toLowerCase().includes(busqueda.toLowerCase().trim());
      }),
    [clientes, busqueda, categoriaActiva]
  );

  return (
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <EncabezadoModulo
          Icono={Users}
          color="#ec4899"
          titulo={t("clientes.titulo")}
          subtitulo={t("clientes.subtitulo")}
        />

        <button className="btn-primary" onClick={abrirNuevo} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={16} /> {t("clientes.agregar")}
        </button>
      </div>

      {!cargando && !error && clientes.length > 0 && (
        <>
          <div className="modulo-resumen">
            <div className="modulo-resumen-item">
              <span className="modulo-resumen-icono">
                <Users size={17} />
              </span>
              <div>
                <span className="modulo-resumen-valor">{clientes.length}</span>
                <span className="modulo-resumen-etiqueta">{t("clientes.resumen_total")}</span>
              </div>
            </div>
            <div className="modulo-resumen-item">
              <span className="modulo-resumen-icono">
                <Wallet size={17} />
              </span>
              <div>
                <span className="modulo-resumen-valor">{formatoMoneda(global.gastoTotal)}</span>
                <span className="modulo-resumen-etiqueta">{t("clientes.resumen_gasto")}</span>
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
                  <span className="modulo-resumen-etiqueta">{t("clientes.resumen_calificacion")}</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <input
              style={{ flex: 1, minWidth: 220 }}
              placeholder={t("clientes.buscar")}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />

            {clientesFiltrados.length > 0 && (
              <button className="btn-secondary" onClick={() => exportarExcel(clientesFiltrados)}>
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
      ) : clientes.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "50px 20px" }}>
          <p style={{ color: "var(--text-secondary)" }}>{t("clientes.sin_clientes")}</p>
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "50px 20px" }}>
          <p style={{ color: "var(--text-secondary)" }}>{t("clientes.sin_resultados_busqueda")}</p>
        </div>
      ) : (
        <div className="clientes-rejilla">
          {clientesFiltrados.map((c) => (
            <div key={c.id} className="cli-tarjeta">
              <div className="cli-cabecera">
                <span className="cli-avatar">{c.nombre.trim().charAt(0).toUpperCase() || "?"}</span>

                <div className="cli-identidad">
                  <h3 className="cli-nombre">{c.nombre}</h3>
                  {typeof c.calificacion === "number" ? (
                    <span className="cli-estrellas" title={`${c.calificacion} / 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          size={13}
                          fill={n <= (c.calificacion ?? 0) ? "currentColor" : "none"}
                        />
                      ))}
                      <span className="cli-estrellas-texto">{c.calificacion} / 5</span>
                    </span>
                  ) : (
                    <span className="cli-sin-calificar">{t("clientes.sin_calificar")}</span>
                  )}
                </div>

                {c.categoria?.trim() && <span className="cli-categoria">{c.categoria.trim()}</span>}
              </div>

              <div className="cli-metricas">
                <div>
                  <span className="cli-metrica-valor">{formatoMoneda(c.totalGastado)}</span>
                  <span className="cli-metrica-etiqueta">{t("clientes.total_gastado")}</span>
                </div>
                <div>
                  <span className="cli-metrica-valor">{c.compras}</span>
                  <span className="cli-metrica-etiqueta">{t("clientes.compras_totales")}</span>
                </div>
              </div>

              {(c.telefono || c.correo || c.notas) && (
                <div className="cli-contacto">
                  {c.telefono && <span>{c.telefono}</span>}
                  {c.correo && <span>{c.correo}</span>}
                  {c.notas && <span className="cli-notas">{c.notas}</span>}
                </div>
              )}

              <div className="cli-acciones">
                {c.telefono && (
                  <a href={`tel:${c.telefono}`} className="btn-secondary cli-accion">
                    <Phone size={14} /> {t("clientes.llamar")}
                  </a>
                )}
                {c.correo && (
                  <a href={`mailto:${c.correo}`} className="btn-secondary cli-accion">
                    <Mail size={14} /> {t("clientes.correo")}
                  </a>
                )}
                <button className="btn-secondary cli-accion" onClick={() => verHistorial(c)}>
                  <History size={14} /> {t("clientes.ver_historial")}
                </button>
                <button className="btn-edit cli-accion" onClick={() => abrirEditar(c)}>
                  {t("clientes.editar")}
                </button>
                <button className="btn-delete cli-accion" onClick={() => alEliminar(c)}>
                  {t("clientes.eliminar")}
                </button>
              </div>
            </div>
          ))}
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
              {editando ? t("clientes.editar_cliente") : t("clientes.nuevo_cliente")}
            </h2>

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
                <label>{t("clientes.nombre")}</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t("clientes.nombre")} />
              </div>

              <div>
                <label>{t("clientes.telefono")}</label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+52 55 1234 5678"
                />
              </div>

              <div>
                <label>{t("clientes.correo")}</label>
                <input
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="cliente@correo.com"
                />
              </div>

              {/* Los dos del panel. Si no se ha corrido
                  supabase_clientes_scorecard.sql, dejarlos vacíos hace
                  que la petición ni los mencione y todo sigue
                  funcionando igual que antes. */}
              <div>
                <label>{t("clientes.categoria")}</label>
                <input
                  value={categoriaForm}
                  onChange={(e) => setCategoriaForm(e.target.value)}
                  placeholder={t("clientes.categoria_placeholder")}
                />
              </div>

              <div>
                <label>{t("clientes.calificacion")}</label>
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
                <label>{t("clientes.notas")}</label>
                <input
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder={t("clientes.notas_placeholder")}
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
                {t("clientes.cancelar")}
              </button>
              <button className="btn-primary" onClick={guardar} disabled={guardando}>
                {guardando ? t("clientes.guardando") : t("clientes.guardar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {clienteHistorial && (
        <HistorialModal
          cliente={clienteHistorial}
          compras={comprasHistorial}
          cargando={cargandoHistorial}
          onClose={() => setClienteHistorial(null)}
        />
      )}
    </main>
  );
}
