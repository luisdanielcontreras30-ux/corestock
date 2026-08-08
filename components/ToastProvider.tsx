"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  ReactNode,
} from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type TipoToast = "exito" | "error" | "info";

interface Toast {
  id: number;
  mensaje: string;
  tipo: TipoToast;
  duracionMs: number;
}

interface ToastContexto {
  mostrarToast: (mensaje: string, tipo?: TipoToast, duracionMs?: number) => void;
}

const Contexto = createContext<ToastContexto>({
  mostrarToast: () => {},
});

export function useToast() {
  return useContext(Contexto);
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const contadorRef = useRef(0);

  const quitarToast = useCallback((id: number) => {
    setToasts((actuales) => actuales.filter((t) => t.id !== id));
  }, []);

  const mostrarToast = useCallback(
    (mensaje: string, tipo: TipoToast = "exito", duracionMs = 4000) => {
      contadorRef.current += 1;
      const id = contadorRef.current;
      setToasts((actuales) => [...actuales, { id, mensaje, tipo, duracionMs }]);
      setTimeout(() => quitarToast(id), duracionMs);
    },
    [quitarToast]
  );

  return (
    <Contexto.Provider value={{ mostrarToast }}>
      {children}

      <div className="toast-contenedor">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tipo} fade-up`}>
            {toast.tipo === "exito" ? (
              <CheckCircle2 size={19} className="toast-icono" />
            ) : toast.tipo === "info" ? (
              <Info size={19} className="toast-icono" />
            ) : (
              <XCircle size={19} className="toast-icono" />
            )}

            <span className="toast-mensaje">{toast.mensaje}</span>

            <button
              className="toast-cerrar"
              onClick={() => quitarToast(toast.id)}
              aria-label="Cerrar"
            >
              <X size={15} />
            </button>

            <div
              className="toast-barra"
              style={{ animationDuration: `${toast.duracionMs}ms` }}
            />
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}
