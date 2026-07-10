export interface Proveedor {
  id: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  notas: string | null;
  activo: boolean;
}

export const PROVEEDOR_VACIO = {
  nombre: "",
  telefono: "",
  correo: "",
  notas: "",
};
