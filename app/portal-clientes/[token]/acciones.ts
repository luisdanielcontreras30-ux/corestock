import { supabase } from "../../../lib/supabase";

export interface CompraPortal {
  id: number;
  fecha: string;
  producto: string;
  cantidad: number;
  precio: number;
  total: number;
}

interface FilaPortalCliente {
  cliente_nombre: string;
  compras: CompraPortal[];
}

export async function obtenerPortalCliente(token: string) {
  const { data, error } = await supabase.rpc("obtener_portal_cliente", {
    p_token: token,
  });

  if (error) throw error;

  const filas = (data ?? []) as FilaPortalCliente[];

  if (filas.length === 0) {
    return { encontrado: false as const };
  }

  const [primera] = filas;

  return {
    encontrado: true as const,
    clienteNombre: primera.cliente_nombre,
    compras: primera.compras ?? [],
  };
}
