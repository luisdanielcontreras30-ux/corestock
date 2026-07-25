// Único lugar donde vive el contacto de soporte — si cambia el
// número, se actualiza aquí y ya queda igual en toda la app (mensaje
// de IA no disponible, apartado de soporte en Configuración, etc.).
export const ENLACE_SOPORTE_WHATSAPP = "https://wa.me/528336601161";

// Apaga las funciones que dependen de la API de Google AI (Análisis
// de producto, el botón "Analizar con IA" de Productos, y la prueba
// del vendedor de WhatsApp) mientras no haya una llave configurada en
// el servidor — en vez de dejar que cada una falle con un error crudo
// al llamarla, muestran el aviso de components/IaNoDisponible.tsx.
// Para reactivarlas cuando sí haya llave, basta con volver esto true.
export const IA_DISPONIBLE = false;
