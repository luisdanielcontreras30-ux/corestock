"use client";

import { History } from "lucide-react";
import { ClienteConResumen } from "../types";
import { useIdioma } from "../../../components/LanguageProvider";
import FilaVacia from "../../../components/FilaVacia";
import { formatoMoneda } from "../../ventas/utils";

interface Props {
  clientes: ClienteConResumen[];
  hayClientesRegistrados: boolean;
  onVerHistorial: (cliente: ClienteConResumen) => void;
  onEditar: (cliente: ClienteConResumen) => void;
  onEliminar: (id: number, nombre: string) => void;
}

export default function ClientesTabla({
  clientes,
  hayClientesRegistrados,
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
            <FilaVacia
              colSpan={6}
              mensaje={hayClientesRegistrados ? t("clientes.sin_resultados_busqueda") : t("clientes.sin_clientes")}
            />
          ) : (
            clientes.map((cliente) => (
              <tr key={cliente.id}>
                <td>{cliente.nombre}</td>
                <td>{cliente.telefono ?? "—"}</td>
                <td>{cliente.correo ?? "—"}</td>
                <td>{cliente.compras}</td>

                <td style={{ fontWeight: 700, color: "var(--primary)" }}>
                  {formatoMoneda(cliente.totalGastado)}
                </td>

                <td>
                  <div className="productos-actions">
                    <button
                      className="btn-secondary"
                      style={{ display: "flex", alignItems: "center", gap: 5 }}
                      onClick={() => onVerHistorial(cliente)}
                    >
                      <History size={13} /> {t("clientes.ver_historial")}
                    </button>

                    <button
                      className="btn-edit"
                      onClick={() => onEditar(cliente)}
                    >
                      {t("clientes.editar")}
                    </button>

                    <button
                      className="btn-delete"
                      onClick={() => onEliminar(cliente.id, cliente.nombre)}
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
