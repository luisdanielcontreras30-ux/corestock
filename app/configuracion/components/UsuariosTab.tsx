"use client";

import { useEffect, useState } from "react";
import { Info, CheckCircle2, XCircle } from "lucide-react";
import {
  Miembro,
  Rol,
  Permiso,
  ROLES,
  PERMISOS,
  PERMISOS_POR_ROL,
} from "../types";
import {
  cargarMiembros,
  crearMiembro,
  actualizarMiembro,
  eliminarMiembro,
  cambiarMiContrasena,
} from "../acciones";
import { useIdioma } from "../../../components/LanguageProvider";

export default function UsuariosTab() {
  const { t } = useIdioma();
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<Miembro | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [rol, setRol] = useState<Rol>("cajero");
  const [permisos, setPermisos] = useState<Permiso[]>(
    PERMISOS_POR_ROL.cajero
  );
  const [guardando, setGuardando] = useState(false);

  const [nuevaContrasena, setNuevaContrasena] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [guardandoPass, setGuardandoPass] = useState(false);
  const [mensajePass, setMensajePass] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  async function refrescar() {
    setCargando(true);
    try {
      const datos = await cargarMiembros();
      setMiembros(datos);
    } catch (error) {
      console.error(error);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    refrescar();
  }, []);

  function abrirNuevo() {
    setEditando(null);
    setNombre("");
    setCorreo("");
    setRol("cajero");
    setPermisos(PERMISOS_POR_ROL.cajero);
    setMostrarForm(true);
  }

  function abrirEditar(m: Miembro) {
    setEditando(m);
    setNombre(m.nombre);
    setCorreo(m.correo ?? "");
    setRol(m.rol);
    setPermisos(m.permisos);
    setMostrarForm(true);
  }

  function alCambiarRol(nuevoRol: Rol) {
    setRol(nuevoRol);
    setPermisos(PERMISOS_POR_ROL[nuevoRol]);
  }

  function alternarPermiso(p: Permiso) {
    setPermisos((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function guardarMiembro() {
    if (guardando) return;

    if (!nombre.trim()) {
      alert(t("usuarios.msg_falta_nombre"));
      return;
    }

    setGuardando(true);

    try {
      if (editando) {
        await actualizarMiembro(editando.id, {
          nombre,
          correo,
          rol,
          permisos,
        });
      } else {
        await crearMiembro(nombre, correo, rol, permisos);
      }

      setMostrarForm(false);
      await refrescar();
    } catch (error) {
      console.error(error);
      alert(t("usuarios.msg_error_guardar_miembro"));
    } finally {
      setGuardando(false);
    }
  }

  async function alEliminar(m: Miembro) {
    if (!confirm(t("usuarios.confirmar_eliminar").replace("{nombre}", m.nombre))) return;

    try {
      await eliminarMiembro(m.id);
      await refrescar();
    } catch (error) {
      console.error(error);
      alert(t("usuarios.msg_error_eliminar"));
    }
  }

  async function alternarActivo(m: Miembro) {
    try {
      await actualizarMiembro(m.id, { activo: !m.activo });
      await refrescar();
    } catch (error) {
      console.error(error);
    }
  }

  async function alCambiarContrasena() {
    if (guardandoPass) return;

    if (nuevaContrasena.length < 6) {
      setMensajePass({ tipo: "error", texto: t("usuarios.msg_pass_corta") });
      return;
    }

    if (nuevaContrasena !== confirmarContrasena) {
      setMensajePass({ tipo: "error", texto: t("usuarios.msg_pass_no_coincide") });
      return;
    }

    setGuardandoPass(true);
    setMensajePass(null);

    try {
      await cambiarMiContrasena(nuevaContrasena);
      setMensajePass({ tipo: "ok", texto: t("usuarios.msg_pass_ok") });
      setNuevaContrasena("");
      setConfirmarContrasena("");
    } catch (error) {
      console.error(error);
      setMensajePass({ tipo: "error", texto: t("usuarios.msg_pass_error") });
    } finally {
      setGuardandoPass(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* AVISO DE ALCANCE */}
      <div
        className="card"
        style={{
          borderColor: "var(--primary)",
          background: "var(--primary-soft)",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <Info size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0 }}>
          {t("usuarios.aviso")}
        </p>
      </div>

      {/* CAMBIAR MI CONTRASEÑA */}
      <div className="card">
        <h2 style={{ marginBottom: 6 }}>{t("usuarios.cambiar_contrasena")}</h2>
        <p
          style={{
            color: "var(--text-secondary)",
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          {t("usuarios.cambiar_contrasena_desc")}
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input
            type="password"
            placeholder={t("usuarios.nueva_contrasena")}
            value={nuevaContrasena}
            onChange={(e) => setNuevaContrasena(e.target.value)}
            style={{ maxWidth: 260 }}
          />

          <input
            type="password"
            placeholder={t("usuarios.confirmar_contrasena")}
            value={confirmarContrasena}
            onChange={(e) => setConfirmarContrasena(e.target.value)}
            style={{ maxWidth: 260 }}
          />

          <button
            className="btn-primary"
            onClick={alCambiarContrasena}
            disabled={guardandoPass}
          >
            {guardandoPass ? t("usuarios.guardando") : t("usuarios.actualizar_contrasena")}
          </button>
        </div>

        {mensajePass && (
          <p
            style={{
              marginTop: 10,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: mensajePass.tipo === "ok" ? "#10b981" : "#ef4444",
            }}
          >
            {mensajePass.tipo === "ok" ? (
              <CheckCircle2 size={14} />
            ) : (
              <XCircle size={14} />
            )}
            {mensajePass.texto}
          </p>
        )}
      </div>

      {/* LISTA DE MIEMBROS */}
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ marginBottom: 4 }}>{t("usuarios.equipo")}</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              {t("usuarios.equipo_desc")}
            </p>
          </div>

          <button className="btn-primary" onClick={abrirNuevo}>
            + {t("usuarios.agregar_miembro")}
          </button>
        </div>

        {cargando ? (
          <p style={{ color: "var(--text-secondary)" }}>{t("header.cargando")}</p>
        ) : miembros.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            {t("usuarios.sin_equipo")}
          </p>
        ) : (
          <div className="tabla">
            <table>
              <thead>
                <tr>
                  <th>{t("usuarios.col_nombre")}</th>
                  <th>{t("usuarios.col_correo")}</th>
                  <th>{t("usuarios.col_rol")}</th>
                  <th>{t("usuarios.col_permisos")}</th>
                  <th>{t("usuarios.col_estado")}</th>
                  <th>{t("usuarios.col_acciones")}</th>
                </tr>
              </thead>

              <tbody>
                {miembros.map((m) => (
                  <tr key={m.id}>
                    <td>{m.nombre}</td>
                    <td>{m.correo || "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>
                      {t(ROLES.find((r) => r.valor === m.rol)?.clave ?? m.rol)}
                    </td>
                    <td>{m.permisos.length} {t("usuarios.permisos_cantidad")}</td>
                    <td>
                      <button
                        onClick={() => alternarActivo(m)}
                        style={{
                          background: m.activo
                            ? "rgba(16,185,129,0.12)"
                            : "rgba(239,68,68,0.12)",
                          color: m.activo ? "#10b981" : "#ef4444",
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {m.activo ? t("usuarios.activo") : t("usuarios.inactivo")}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="btn-edit"
                          onClick={() => abrirEditar(m)}
                        >
                          {t("usuarios.editar")}
                        </button>
                        <button
                          className="btn-delete"
                          onClick={() => alEliminar(m)}
                        >
                          {t("usuarios.eliminar")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL CREAR / EDITAR */}
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
            style={{ width: "100%", maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: 20 }}>
              {editando ? t("usuarios.editar_miembro") : t("usuarios.agregar_miembro")}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label>{t("usuarios.col_nombre")}</label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder={t("usuarios.nombre_completo")}
                />
              </div>

              <div>
                <label>{t("usuarios.correo_opcional")}</label>
                <input
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div>
                <label>{t("usuarios.col_rol")}</label>
                <select
                  value={rol}
                  onChange={(e) => alCambiarRol(e.target.value as Rol)}
                >
                  {ROLES.map((r) => (
                    <option key={r.valor} value={r.valor}>
                      {t(r.clave)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ marginBottom: 8, display: "block" }}>
                  {t("usuarios.permisos_personalizados")}
                </label>

                <div
                  className="form-grid-2col"
                  style={{
                    background: "var(--glass-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    padding: 14,
                  }}
                >
                  {PERMISOS.map((p) => (
                    <label
                      key={p.valor}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        color: "var(--text-primary)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={permisos.includes(p.valor)}
                        onChange={() => alternarPermiso(p.valor)}
                        style={{ width: "auto" }}
                      />
                      {t(p.clave)}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 22,
              }}
            >
              <button
                className="btn-secondary"
                onClick={() => setMostrarForm(false)}
              >
                {t("usuarios.cancelar")}
              </button>

              <button
                className="btn-primary"
                onClick={guardarMiembro}
                disabled={guardando}
              >
                {guardando ? t("usuarios.guardando") : t("usuarios.guardar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
