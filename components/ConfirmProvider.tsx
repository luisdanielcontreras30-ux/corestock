"use client";

import React, { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useIdioma } from "./LanguageProvider";

interface OpcionesConfirmar {
  titulo?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  peligroso?: boolean;
}

interface PeticionConfirmar extends OpcionesConfirmar {
  mensaje: string;
}

interface ConfirmContexto {
  confirmar: (mensaje: string, opciones?: OpcionesConfirmar) => Promise<boolean>;
}

const Contexto = createContext<ConfirmContexto>({
  confirmar: async () => false,
});

export function useConfirm() {
  return useContext(Contexto);
}

// Reemplazo del confirm() nativo del navegador (feo, bloqueante e
// inconsistente entre dispositivos) por un modal propio, respetando
// el mismo patrón que ToastProvider: contexto + promesa.
export default function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useIdioma();
  const [peticion, setPeticion] = useState<PeticionConfirmar | null>(null);
  const resolverRef = useRef<((valor: boolean) => void) | null>(null);

  const confirmar = useCallback((mensaje: string, opciones: OpcionesConfirmar = {}) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPeticion({ mensaje, ...opciones });
    });
  }, []);

  function resolver(valor: boolean) {
    resolverRef.current?.(valor);
    resolverRef.current = null;
    setPeticion(null);
  }

  return (
    <Contexto.Provider value={{ confirmar }}>
      {children}

      {peticion && (
        <div className="factura-overlay" onClick={() => resolver(false)}>
          <div className="card confirm-dialog fade-up" onClick={(e) => e.stopPropagation()}>
            <div className={`confirm-dialog-icono${peticion.peligroso ? " confirm-dialog-icono-peligro" : ""}`}>
              <AlertTriangle size={22} />
            </div>

            {peticion.titulo && <h3>{peticion.titulo}</h3>}
            <p>{peticion.mensaje}</p>

            <div className="confirm-dialog-botones">
              <button className="btn-secondary" onClick={() => resolver(false)}>
                {peticion.textoCancelar ?? t("comun.cancelar")}
              </button>
              <button
                className={peticion.peligroso ? "btn-primary confirm-dialog-btn-peligro" : "btn-primary"}
                onClick={() => resolver(true)}
              >
                {peticion.textoConfirmar ?? t("comun.confirmar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Contexto.Provider>
  );
}
