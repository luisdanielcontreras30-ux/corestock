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

// Enciende las funciones de IA con pantalla propia: Análisis de
// producto, el botón "Analizar con IA" de Productos y la prueba del
// vendedor de WhatsApp. En falso muestran el aviso de
// components/IaNoDisponible.tsx en vez de un botón que falla.
//
// Está en true porque el servidor ya sabe hablar con dos proveedores
// (OpenRouter y Google AI Studio, ver lib/openrouter.ts y
// lib/googleAI.ts) y basta con que UNO tenga su llave puesta.
//
// Esto es una constante y no una lectura del entorno a propósito: son
// componentes de navegador, y la llave vive solo en el servidor —
// preguntarle al servidor si la tiene costaría una petición extra en
// cada carga de pantalla. El precio de esa simplicidad es que si se
// despliega SIN ninguna llave, los botones aparecen y responden con el
// mensaje traducido de "no disponible, contacta a soporte" en vez de
// estar ocultos. Si se prefiere ocultarlos, volver esto a false.
export const IA_DISPONIBLE = true;
