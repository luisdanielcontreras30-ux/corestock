"use client";

import { useEffect, useState } from "react";
import { Phone, Mail, Plus, Truck } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import { Proveedor } from "./types";
import {
  cargarProveedores,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
} from "./acciones";

export default function ProveedoresPage() {
  const { user } = useAuth();
  const { t } = useIdioma();

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Proveedor | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    if (user) refrescar();
  }, [user]);

  async function refrescar() {
    if (!user) return;
    setCargando(true);
    try {
      const datos = await cargarProveedores(user.id);
      setProveedores(datos);
    } catch (error) {
      console.error(error);
      alert(t("comun.msg_error_cargar_datos"));
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

  function abrirEditar(p: Proveedor) {
    setEditando(p);
    setNombre(p.nombre);
    setTelefono(p.telefono ?? "");
    setCorreo(p.correo ?? "");
    setNotas(p.notas ?? "");
    setMostrarForm(true);
  }

  async function guardar() {
    if (!user || guardando) return;

    if (!nombre.trim()) {
      alert(t("proveedores.msg_falta_nombre"));
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
      alert(t("proveedores.msg_error_guardar"));
    } finally {
      setGuardando(false);
    }
  }

  async function alEliminar(p: Proveedor) {
    if (!user) return;

    if (!confirm(t("proveedores.confirmar_eliminar").replace("{nombre}", p.nombre))) {
      return;
    }

    try {
      await eliminarProveedor(user.id, p.id);
      await refrescar();
    } catch (error) {
      console.error(error);
      alert(t("proveedores.msg_error_eliminar"));
    }
  }

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

      {cargando ? (
        <div className="card">{t("header.cargando")}</div>
      ) : proveedores.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "50px 20px" }}>
          <p style={{ color: "var(--text-secondary)" }}>{t("proveedores.sin_proveedores")}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
          {proveedores.map((p) => (
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

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
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
            zIndex: 200,
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
    </main>
  );
}
