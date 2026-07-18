"use client";

import { useEffect, useState } from "react";
import { Phone, Mail, Plus, Truck, History } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import RequierePlus from "../../components/RequierePlus";
import HistorialModal from "./components/HistorialModal";
import { ProveedorConResumen, CompraProveedor } from "./types";
import {
  cargarProveedores,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
  cargarHistorialCompras,
} from "./acciones";
import { formatoMoneda } from "../ventas/utils";

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

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [notas, setNotas] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (user) refrescar();
  }, [user]);

  async function refrescar() {
    if (!user) return;
    setCargando(true);
    setError(false);
    try {
      const datos = await cargarProveedores(user.id);
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
  }

  function abrirEditar(p: ProveedorConResumen) {
    setEditando(p);
    setNombre(p.nombre);
    setTelefono(p.telefono ?? "");
    setCorreo(p.correo ?? "");
    setNotas(p.notas ?? "");
    setMostrarForm(true);
  }

  async function verHistorial(p: ProveedorConResumen) {
    if (!user) return;

    setProveedorHistorial(p);
    setCargandoHistorial(true);

    try {
      const datos = await cargarHistorialCompras(user.id, p.id);
      setComprasHistorial(datos);
    } catch (error) {
      console.error(error);
      setComprasHistorial([]);
      mostrarToast(t("comun.msg_error_cargar_datos"), "error");
    } finally {
      setCargandoHistorial(false);
    }
  }

  async function guardar() {
    if (!user || guardando) return;

    if (!nombre.trim()) {
      mostrarToast(t("proveedores.msg_falta_nombre"), "error");
      return;
    }

    setGuardando(true);

    try {
      if (editando) {
        await actualizarProveedor(user.id, editando.id, {
          nombre,
          telefono,
          correo,
          notas,
        });
      } else {
        await crearProveedor(user.id, nombre, telefono, correo, notas);
      }

      setMostrarForm(false);
      await refrescar();
    } catch (error) {
      console.error(error);
      mostrarToast(t("proveedores.msg_error_guardar"), "error");
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
      await eliminarProveedor(user.id, p.id);
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

  const proveedoresFiltrados = proveedores.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase().trim())
  );

  return (
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <EncabezadoModulo
          Icono={Truck}
          color="#f59e0b"
          titulo={t("proveedores.titulo")}
          subtitulo={t("proveedores.subtitulo")}
        />

        <button className="btn-primary" onClick={abrirNuevo} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={16} /> {t("proveedores.agregar")}
        </button>
      </div>

      {!cargando && proveedores.length > 0 && (
        <input
          placeholder={t("proveedores.buscar")}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      )}

      {cargando ? (
        <div className="card">{t("header.cargando")}</div>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
          {proveedoresFiltrados.map((p) => (
            <div key={p.id} className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{p.nombre}</h3>

              {p.telefono && (
                <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 4 }}>{p.telefono}</p>
              )}

              {p.correo && (
                <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 10 }}>{p.correo}</p>
              )}

              {p.notas && (
                <p style={{ color: "var(--text-muted)", fontSize: 12.5, marginBottom: 14 }}>{p.notas}</p>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {p.telefono && (
                  <a
                    href={`tel:${p.telefono}`}
                    className="btn-primary"
                    style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 13 }}
                  >
                    <Phone size={14} /> {t("proveedores.llamar")}
                  </a>
                )}

                {p.correo && (
                  <a
                    href={`mailto:${p.correo}`}
                    className="btn-secondary"
                    style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 13 }}
                  >
                    <Mail size={14} /> {t("proveedores.correo")}
                  </a>
                )}
              </div>

              <p style={{ color: "var(--text-secondary)", fontSize: 12.5, marginBottom: 4 }}>
                {t("proveedores.compras_totales")}: {p.compras} · {t("proveedores.total_gastado")}: {formatoMoneda(p.totalGastado)}
              </p>

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button className="btn-secondary" onClick={() => verHistorial(p)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <History size={14} /> {t("proveedores.ver_historial")}
                </button>
                <button className="btn-edit" onClick={() => abrirEditar(p)}>
                  {t("proveedores.editar")}
                </button>
                <button className="btn-delete" onClick={() => alEliminar(p)}>
                  {t("proveedores.eliminar")}
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
            background: "rgba(0,0,0,0.55)",
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
            style={{ width: "100%", maxWidth: 460 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: 20 }}>
              {editando ? t("proveedores.editar_proveedor") : t("proveedores.nuevo_proveedor")}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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

              <div>
                <label>{t("proveedores.notas")}</label>
                <input
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder={t("proveedores.notas_placeholder")}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
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
