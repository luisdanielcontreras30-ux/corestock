"use client";

import { LayoutGrid, BookOpen, Boxes, Calculator, LucideIcon } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";

export type TabFabricacion = "tablero" | "recetas" | "stock" | "cotizacion";

interface Props {
  activa: TabFabricacion;
  onCambiar: (tab: TabFabricacion) => void;
}

const tabs: { id: TabFabricacion; clave: string; Icono: LucideIcon }[] = [
  { id: "tablero", clave: "fabricacion.tab_tablero", Icono: LayoutGrid },
  { id: "recetas", clave: "fabricacion.recetas", Icono: BookOpen },
  { id: "stock", clave: "fabricacion.tab_stock", Icono: Boxes },
  { id: "cotizacion", clave: "fabricacion.cotizacion", Icono: Calculator },
];

// Reutiliza las mismas clases que la barra de pestañas de Configuración
// (.config-tabs/.config-tab/.config-tab-active en globals.css) en vez
// de inventar un estilo nuevo para lo mismo.
export default function FabricacionTabs({ activa, onCambiar }: Props) {
  const { t } = useIdioma();

  return (
    <div className="config-tabs">
      {tabs.map((tab) => {
        const Icono = tab.Icono;
        return (
          <button
            key={tab.id}
            className={`config-tab ${activa === tab.id ? "config-tab-active" : ""}`}
            onClick={() => onCambiar(tab.id)}
          >
            <Icono size={15} />
            {t(tab.clave)}
          </button>
        );
      })}
    </div>
  );
}
