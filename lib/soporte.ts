// Único lugar donde vive el contacto de soporte — si cambia el
// número, se actualiza aquí y ya queda igual en toda la app (mensaje
// de IA no disponible, apartado de soporte en Configuración, etc.).
// Solo dígitos, con lada de país al frente: así lo exige wa.me.
export const NUMERO_SOPORTE_WHATSAPP = "528336601161";

export const ENLACE_SOPORTE_WHATSAPP = `https://wa.me/${NUMERO_SOPORTE_WHATSAPP}`;

// Versión legible para mostrar en pantalla. El enlace de wa.me abre
// WhatsApp Web en computadora (y pide iniciar sesión ahí), así que
// tener el número a la vista deja guardarlo o marcarlo desde el
// teléfono sin depender de que el enlace funcione.
export const NUMERO_SOPORTE_VISIBLE = "+52 833 660 1161";

// Apaga las funciones que dependen de la API de Google AI (Análisis
// de producto, el botón "Analizar con IA" de Productos, y la prueba
// del vendedor de WhatsApp) mientras no haya una llave configurada en
// el servidor — en vez de dejar que cada una falle con un error crudo
// al llamarla, muestran el aviso de components/IaNoDisponible.tsx.
// Para reactivarlas cuando sí haya llave, basta con volver esto true.
export const IA_DISPONIBLE = false;
