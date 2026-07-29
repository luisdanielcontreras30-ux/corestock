# CoreStock

Sistema de inventario y ventas (Next.js + Supabase).

## Configuración

Este proyecto necesita conectarse a un proyecto de Supabase. Copia `.env.example` a `.env.local` y llena los valores:

```bash
cp .env.example .env.local
```

Variables requeridas (`.env.local`):

- `NEXT_PUBLIC_SUPABASE_URL` — URL de tu proyecto de Supabase (Project Settings → API).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/publishable key del mismo proyecto (Project Settings → API). Es segura de exponer en el cliente siempre y cuando las tablas tengan Row Level Security (RLS) habilitado con políticas por `user_id`.

Sin estas dos variables, `npm run build` y `npm run dev` fallan con el error `Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**Si despliegas en Vercel/Netlify:** agrega estas mismas dos variables en el panel de Environment Variables del proyecto (no basta con tenerlas solo en `.env.local`, ese archivo nunca se sube al repositorio) y vuelve a desplegar.

### CoreStock Plus+ (suscripciones con Stripe, opcional)

Solo son necesarias si quieres activar el plan de pago. Sin ellas, la app funciona normal en el plan gratuito.

- `SUPABASE_SERVICE_ROLE_KEY` — service_role key del mismo proyecto de Supabase (Project Settings → API). **Nunca** la expongas con prefijo `NEXT_PUBLIC_`: solo la usa el webhook de Stripe en el servidor.
- `STRIPE_SECRET_KEY` — llave secreta de tu cuenta de Stripe (Developers → API keys).
- `STRIPE_WEBHOOK_SECRET` — se genera al crear el endpoint del webhook en Stripe (Developers → Webhooks), apuntando a `/api/stripe/webhook`.
- `STRIPE_PRICE_ID_PLUS` — el Price ID (no el Product ID) del precio mensual de Plus+ en Stripe.

Recuerda ejecutar `supabase_suscripciones.sql` en el SQL Editor de Supabase antes de probar pagos — sin esa migración las columnas de plan no existen y la suscripción nunca se activa.

### Análisis de fotos de producto con IA (Google AI Studio, opcional)

Solo es necesaria para el botón "Analizar foto con IA" en Productos. Sin ella, el resto de la app funciona normal — ese botón simplemente muestra un error.

- `GOOGLE_AI_API_KEY` — API key de Google AI Studio (https://aistudio.google.com/apikey). **Nunca** la expongas con prefijo `NEXT_PUBLIC_`: solo la usa el servidor.
- `GOOGLE_AI_MODEL` — opcional, modelo de Gemini a usar (por defecto `gemini-flash-latest`).

Recuerda ejecutar `supabase_productos_descripcion.sql` en el SQL Editor de Supabase — sin esa migración la columna `descripcion` no existe y guardar el producto falla después de analizarlo.

### IA: Groq para el texto, Google para las fotos (opcional)

El trabajo está repartido entre dos proveedores, cada uno en lo que hace mejor:

| Función | Proveedor | Llave |
| --- | --- | --- |
| Asistente (conversación abierta) | Groq | `GROQ_API_KEY` |
| Vendedor de WhatsApp | Groq (Google si no hay llave de Groq) | `GROQ_API_KEY` |
| Analizar fotos de producto | Google AI (Groq si no hay llave de Google) | `GOOGLE_AI_API_KEY` |

La capa gratuita de Groq es excelente para texto, pero su catálogo de modelos que saben **ver** es corto y rota seguido, así que el análisis de fotos se rompía cada vez que retiraban uno. Gemini lleva la visión en su modelo por defecto y no hay que perseguir identificadores. Quien prefiera seguir con Groq para las fotos solo tiene que no poner la llave de Google y dejar un modelo de visión válido en `GROQ_MODEL_VISION`.

- `GROQ_API_KEY` — API key de Groq (https://console.groq.com/keys). Groq tiene capa gratuita con límite de peticiones por minuto, así que se puede probar sin tarjeta. **Nunca** la expongas con prefijo `NEXT_PUBLIC_`: solo la usa el servidor. Si llegara al navegador, cualquiera que abra la app podría leerla y usarla por su cuenta.
- `GROQ_MODEL` — opcional, modelo de texto (por defecto `llama-3.3-70b-versatile`). Lista y precios en https://console.groq.com/docs/models.
- `GROQ_MODEL_VISION` — opcional, modelo de Groq para analizar fotos (por defecto `meta-llama/llama-4-scout-17b-16e-instruct`). **Solo se usa si no hay `GOOGLE_AI_API_KEY`**; si la hay, las fotos las atiende Google y esta variable se ignora. Tiene que ser un modelo que **sepa ver imágenes**.
- `GOOGLE_AI_API_KEY` — API key de Google AI Studio (https://aistudio.google.com/apikey), la que atiende las fotos. También tiene capa gratuita.
- `GOOGLE_AI_MODEL` — opcional, modelo de Gemini (por defecto `gemini-flash-latest`).

> Groq retira y renueva modelos con frecuencia. Si el valor por defecto ya no existe, la llamada falla con `model not found` — el botón **Probar la IA** de Configuración → Ayuda te lo dice tal cual, y se arregla cambiando la variable, sin tocar código.

El interruptor `IA_DISPONIBLE` en `lib/soporte.ts` controla si el análisis de fotos y el vendedor de WhatsApp muestran sus botones. Está en `true`; si despliegas sin ninguna llave, esos botones aparecen y responden "no disponible, contacta a soporte" — ponlo en `false` si prefieres ocultarlos.

**Sin ninguna llave el Asistente no se rompe.** Cae a su motor de reglas: 65 temas de negocio, finanzas y libros en 7 idiomas, calculadora en lenguaje natural y consultas a los datos reales del negocio. Lo mismo pasa si Groq limita las peticiones o falla — el respaldo entra solo, sin mostrar ningún error. Para distinguir "no configurada" de "configurada pero se cayó", usa **Probar la IA** en Configuración → Ayuda: prueba el texto y las fotos por separado, y dice qué proveedor y qué modelo atiende cada uno.

Cuando la IA sí está activa, la ruta le pasa como contexto un resumen de los números reales del negocio (ventas del día/semana/mes, valor del inventario, agotados, producto y cliente top), leído con el JWT de quien pregunta, así que RLS decide qué puede ver cada quien. Hay un tope de 60 preguntas por hora y por usuario, para que un bucle accidental no consuma la cuota.

## Desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Build de producción

```bash
npm run build
npm run start
```

## Stack

- Next.js (App Router) + TypeScript
- Supabase (auth + base de datos + storage)
- Recharts (gráficas)
- lucide-react (íconos)
