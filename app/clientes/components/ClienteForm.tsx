"use client";

import { DatosClienteForm } from "../types";
import { useIdioma } from "../../../components/LanguageProvider";

interface Props {
  datos: DatosClienteForm;
  setDatos: (v: DatosClienteForm) => void;
  editando: boolean;
  guardando: boolean;
  onGuardar: () => void;
  onCancelar: () => void;
}

export default function ClienteForm({
  datos,
  setDatos,
  editando,
  guardando,
  onGuardar,
  onCancelar,
}: Props) {
  const { t } = useIdioma();

  return (
    <div className="card">
      <h2 style={{ marginBottom: 20 }}>
        {editando
          ? t("clientes.editar_cliente")
          : t("clientes.nuevo_cliente")}
      </h2>

      <div className="form-grid-2col">
        <div>
          <label>{t("clientes.nombre")}</label>

          <input
            type="text"
            value={datos.nombre}
            onChange={(e) =>
              setDatos({ ...datos, nombre: e.target.value })
            }
            placeholder={t("clientes.nombre")}
          />
        </div>

        <div>
          <label>{t("clientes.telefono")}</label>

          <input
            type="text"
            value={datos.telefono}
            onChange={(e) =>
              setDatos({ ...datos, telefono: e.target.value })
            }
            placeholder={t("clientes.telefono")}
          />
        </div>

        <div>
          <label>{t("clientes.correo")}</label>

          <input
            type="email"
            value={datos.correo}
            onChange={(e) =>
              setDatos({ ...datos, correo: e.target.value })
            }
            placeholder={t("clientes.correo")}
          />
        </div>

        <div>
          <label>{t("clientes.notas")}</label>

          <input
            type="text"
            value={datos.notas}
            onChange={(e) =>
              setDatos({ ...datos, notas: e.target.value })
            }
            placeholder={t("clientes.notas")}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
          marginTop: 24,
        }}
      >
        {editando && (
          <button
            className="btn-secondary"
            disabled={guardando}
            onClick={onCancelar}
          >
            {t("clientes.cancelar")}
          </button>
        )}

        <button
          className="btn-primary"
          disabled={guardando}
          onClick={onGuardar}
        >
          {guardando
            ? t("clientes.guardando")
            : editando
              ? t("clientes.actualizar")
              : t("clientes.guardar")}
        </button>
      </div>
    </div>
  );
}
