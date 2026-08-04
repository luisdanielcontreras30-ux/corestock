export interface MensajeChat {
  id: number;
  autor_id: string;
  autor_nombre: string;
  texto: string;
  imagen_url: string | null;
  creado_en: string;
}
