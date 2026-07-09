"use client";

import { Palette, Store, Users, UserCircle, Globe, LucideIcon } from "lucide-react";
import { useIdioma } from "../../../components/LanguageProvider";

interface Props {
  activa: string;
  onCambiar: (tab: string) => void;
}

const tabs: { id: string; clave: string; Icono: LucideIcon }[] = [
  { id: "apariencia", clave: "config.tab.apariencia", Icono: Palette },
  { id: "empresa", clave: "config.tab.empresa", Icono: Store },
  { id: "usuarios", clave: "config.tab.usuarios", Icono: Users },
  { id: "cuenta", clave: "config.tab.cuenta", Icono: UserCircle },
  { id: "idioma", clave: "config.tab.idioma", Icono: Globe },
];

export default function ConfigTabs({ activa, onCambiar }: Props) {
  const { t } = useIdioma();

  return (
    <div className="config-tabs">
      {tabs.map((tab) => {
        const Icono = tab.Icono;

        return (
          <button
            key={tab.id}
            className={`config-tab ${
              activa === tab.id ? "config-tab-active" : ""
            }`}
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
