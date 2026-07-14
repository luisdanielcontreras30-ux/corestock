"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Percent, Trash2 } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import RequierePlus from "../../components/RequierePlus";
import { Producto, Promocion, TipoDescuento } from "./types";
import {
  cargarDatos,
  crearPromocion,
  alternarActivaPromocion,
  eliminarPromocion,
} from "./acciones";

export default function PromocionesPage() {
  return (
    <RequierePlus>
      <PromocionesContenido />
    </RequierePlus>
  );
}

function PromocionesContenido() {
  const router = useRouter();
  const { user, cargando: cargandoAuth } = useAuth();
  const { t } = useIdioma();

  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [promociones, setPromociones] = useState<Promocion[]>([]);

  const [nombre, setNombre] = useState("");
  const [productoId, setProductoId] = useState("");
  const [tipo, setTipo] = useState<TipoDescuento>("porcentaje");
  const [valor, setValor] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function obtenerDatos() {
    setLoading(true);
    try {
      const datos = await cargarDatos();
      setProductos(datos.productos);
      setPromociones(datos.promociones);
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

  const valorNum = Number(valor) || 0;

  function limpiar() {
    setNombre("");
    setProductoId("");
    setTipo("porcentaje");
    setValor("");
    setFechaInicio("");
    setFechaFin("");
  }

  async function guardar() {
    if (guardando) return;

    if (!nombre.trim()) {
      alert(t("promociones.msg_falta_nombre"));
      return;
    }

    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      alert(t("promociones.msg_valor_invalido"));
      return;
    }

    if (tipo === "porcentaje" && valorNum > 100) {
      alert(t("promociones.msg_porcentaje_invalido"));
      return;
    }

    const producto = productoId
      ? productos.find((p) => p.id === Number(productoId)) ?? null
      : null;

    try {
      setGuardando(true);
      await crearPromocion(nombre, producto, tipo, valorNum, fechaInicio, fechaFin);

      limpiar();
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(t("promociones.msg_error_guardar"));
    } finally {
      setGuardando(false);
    }
  }

  async function alternar(promo: Promocion) {
    try {
      await alternarActivaPromocion(promo.id, !promo.activa);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(t("promociones.msg_error_estado"));
    }
  }

  async function borrar(id: number) {
    if (!confirm(t("promociones.confirmar_eliminar"))) return;

    try {
      await eliminarPromocion(id);
      await obtenerDatos();
    } catch (error) {
      console.error(error);
      alert(t("promociones.msg_error_eliminar"));
    }
  }

  function formatoDescuento(promo: Promocion) {
    return promo.tipo === "porcentaje"
      ? `${promo.valor}%`
      : `$${Number(promo.valor).toFixed(2)}`;
  }

  function formatoVigencia(promo: Promocion) {
    const inicio = promo.fecha_inicio
      ? new Date(promo.fecha_inicio).toLocaleDateString()
      : null;
    const fin = promo.fecha_fin
      ? new Date(promo.fecha_fin).toLocaleDateString()
      : null;

    if (!inicio && !fin) return t("promociones.sin_vigencia");
    if (inicio && fin) return `${inicio} — ${fin}`;
    if (inicio) return `${t("promociones.desde")} ${inicio}`;
    return `${t("promociones.hasta")} ${fin}`;
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
        Icono={Percent}
        color="#f97316"
        titulo={t("sidebar.promociones")}
        subtitulo={t("promociones.subtitulo")}
      />

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{t("promociones.crear")}</h2>

        <div className="productos-grid">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={t("promociones.nombre_placeholder")}
          />

          <select value={productoId} onChange={(e) => setProductoId(e.target.value)}>
            <option value="">{t("promociones.todos_productos")}</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>

          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDescuento)}>
            <option value="porcentaje">{t("promociones.tipo_porcentaje")}</option>
            <option value="monto">{t("promociones.tipo_monto")}</option>
          </select>

          <input
            type="number"
            min="0"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={tipo === "porcentaje" ? t("promociones.valor_porcentaje") : t("promociones.valor_monto")}
          />
        </div>

        <div className="productos-grid" style={{ marginTop: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {t("promociones.fecha_inicio")}
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {t("promociones.fecha_fin")}
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? t("compras.guardando") : t("promociones.crear")}
          </button>
        </div>
      </div>

      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>{t("promociones.col_nombre")}</th>
              <th>{t("tabla.producto")}</th>
              <th>{t("promociones.col_descuento")}</th>
              <th>{t("promociones.col_vigencia")}</th>
              <th>{t("usuarios.col_estado")}</th>
              <th>{t("productos.col_acciones")}</th>
            </tr>
          </thead>

          <tbody>
            {promociones.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  {t("promociones.sin_promociones")}
                </td>
              </tr>
            ) : (
              promociones.map((promo) => (
                <tr key={promo.id}>
                  <td>{promo.nombre}</td>
                  <td>{promo.producto || t("promociones.todos_productos")}</td>
                  <td style={{ fontWeight: 700, color: "var(--primary)" }}>
                    {formatoDescuento(promo)}
                  </td>
                  <td>{formatoVigencia(promo)}</td>
                  <td>
                    <button
                      onClick={() => alternar(promo)}
                      style={{
                        background: promo.activa ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                        color: promo.activa ? "#10b981" : "#ef4444",
                        border: "none",
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {promo.activa ? t("usuarios.activo") : t("usuarios.inactivo")}
                    </button>
                  </td>
                  <td>
                    <button
                      className="btn-delete"
                      aria-label={t("productos.eliminar")}
                      onClick={() => borrar(promo.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
