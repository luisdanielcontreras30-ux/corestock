"use client";

import { History } from "lucide-react";
import { ClienteConResumen } from "../types";
import { useIdioma } from "../../../components/LanguageProvider";

interface Props {
  clientes: ClienteConResumen[];
  onVerHistorial: (cliente: ClienteConResumen) => void;
  onEditar: (cliente: ClienteConResumen) => void;
  onEliminar: (id: number) => void;
}

export default function ClientesTabla({
  clientes,
  onVerHistorial,
  onEditar,
  onEliminar,
}: Props) {
  const { t } = useIdioma();

  return (
    <div className="tabla">
      <table>
        <thead>
          <tr>
            <th>{t("clientes.nombre")}</th>
            <th>{t("clientes.telefono")}</th>
            <th>{t("clientes.correo")}</th>
            <th>{t("clientes.col_compras")}</th>
            <th>{t("clientes.col_total_gastado")}</th>
            <th>{t("clientes.col_acciones")}</th>
          </tr>
        </thead>

        <tbody>
          {clientes.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", padding: 30 }}>
                {t("clientes.sin_clientes")}
              </td>
            </tr>
          ) : (
            clientes.map((cliente) => (
              <tr key={cliente.id}>
                <td>{cliente.nombre}</td>
                <td>{cliente.telefono ?? "—"}</td>
                <td>{cliente.correo ?? "—"}</td>
                <td>{cliente.compras}</td>

                <td style={{ fontWeight: 700, color: "var(--primary)" }}>
                  ${cliente.totalGastado.toFixed(2)}
                </td>

                <td>
                  <div className="productos-actions">
                    <button
                      className="btn-edit"
                      style={{ display: "flex", alignItems: "center", gap: 5 }}
                      onClick={() => onVerHistorial(cliente)}
                    >
                      <History size={13} /> {t("clientes.ver_historial")}
                    </button>

                    <button
                      className="btn-secondary"
                      onClick={() => onEditar(cliente)}
                    >
                      {t("clientes.editar")}
                    </button>

                    <button
                      className="btn-delete"
                      onClick={() => onEliminar(cliente.id)}
                    >
                      {t("clientes.eliminar")}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
