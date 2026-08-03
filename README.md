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

## Migraciones SQL

CoreStock no usa un sistema de migraciones automático: cada archivo `supabase_*.sql` en la raíz del repo se corre a mano, UNA vez, en el SQL Editor de tu proyecto de Supabase. Todos son idempotentes (usan `if not exists` / `drop policy if exists`) — si no recuerdas si ya corriste alguno, volver a correrlo no rompe nada ni duplica datos.

Sin la migración correspondiente, el módulo relacionado no truena la app entera: normalmente el formulario falla al guardar con un error de Postgres, o la pantalla se ve pero con una función faltando (por ejemplo la calificación de un proveedor, o el color del catálogo). El error suele traer el nombre de la columna o tabla que falta.

Orden sugerido — primero seguridad, luego cada módulo según lo vayas usando:

| Archivo | Para qué es |
| --- | --- |
| `supabase_seguridad_rls.sql` | Habilita Row Level Security en todas las tablas. Correr primero, antes que cualquier otro. |
| `supabase_seguridad_suscripcion.sql` | Cierra un hueco de RLS en `empresa_config` (cualquiera podía editar la suscripción de otro negocio). Correr cuanto antes. |
| `supabase_permisos_miembros.sql` | Da a los miembros del equipo (no el dueño) acceso a las tablas del negocio con su propia sesión, en vez de la del dueño. |
| `supabase_password_miembros.sql` | Contraseña individual por miembro del equipo. |
| `supabase_miembros_nombre_unico.sql` | Evita que dos miembros del mismo negocio compartan nombre (rompía "entrar como miembro"). |
| `supabase_clientes.sql` | Campos de contacto/notas en Clientes. |
| `supabase_clientes_scorecard.sql` | Categoría en Clientes (rediseño estilo Proveedores). La calificación por estrellas es automática, según compras — no necesita columna. |
| `supabase_proveedores_scorecard.sql` | Categoría, calificación y días de entrega en Proveedores. |
| `supabase_compras.sql` | Tabla del módulo Compras. |
| `supabase_cotizaciones.sql` | Tabla del módulo Cotizaciones. |
| `supabase_cotizaciones_items.sql` | Cotizaciones a varias líneas, con productos, servicios y mano de obra (después de `supabase_cotizaciones.sql`). |
| `supabase_ajustes_stock.sql` | Tabla del módulo Ajustes de Stock. |
| `supabase_promociones.sql` | Tabla del módulo Promociones. |
| `supabase_caja.sql` | Tabla del módulo Caja. |
| `supabase_caja_atomico.sql` | Valida en el servidor que no se saque más de lo que hay en caja (después de `supabase_caja.sql`). |
| `supabase_facturas_globales.sql` | Tabla del módulo Facturas Globales. |
| `supabase_fabricacion.sql` | Tablas del módulo Fabricación (materias primas, recetas, producciones). |
| `supabase_conciliaciones.sql` | Tabla del módulo Conciliaciones. |
| `supabase_traspasos.sql` | Tablas del módulo Traspasos (stock por ubicación). |
| `supabase_devoluciones.sql` | Tabla del módulo Devoluciones. |
| `supabase_servicios.sql` | Tabla del módulo Servicios (negocios que cobran trabajos, no productos). |
| `supabase_servicios_fecha_cobro.sql` | Columna `fecha_cobro` en Servicios, para que Dashboard/Gráficas cuenten el ingreso el día en que se cobró (después de `supabase_servicios.sql`). |
| `supabase_servicios_plantillas.sql` | Tabla de plantillas de "Servicios rápidos" — servicios de precio fijo que se cobran de un toque (después de `supabase_servicios.sql`). |
| `supabase_cuentas_por_cobrar.sql` | Seguimiento de ventas fiadas (método de pago "préstamo"). |
| `supabase_catalogo_linea.sql` | Catálogo en línea público (sin sesión), interruptor en Configuración. |
| `supabase_catalogo_apariencia.sql` | Colores del catálogo en línea (después de `supabase_catalogo_linea.sql`). |
| `supabase_portal_clientes.sql` | Enlace único por cliente para ver su historial sin cuenta. |
| `supabase_productos_descripcion.sql` | Columna `descripcion` en Productos (la llena el análisis por IA). Ver [más arriba](#análisis-de-fotos-de-producto-con-ia-google-ai-studio-opcional). |
| `supabase_productos_stock_minimo.sql` | Stock mínimo configurable por producto, usado por Alertas. |
| `supabase_ventas_metodo_pago.sql` | Método de pago por venta (efectivo, tarjeta, transferencia, préstamo). |
| `supabase_ventas_validacion_precio.sql` | Valida en el servidor el precio de cada venta (antes solo se calculaba en el navegador). |
| `supabase_dashboard_agregado.sql` | Función agregada para que el Dashboard no traiga toda la tabla de ventas en cada visita. |
| `supabase_modo_interfaz.sql` | Preferencia CoreStock Easy / Completo por negocio. |
| `supabase_personalizacion_negocio.sql` | Tipo de negocio y accesos de menú recomendados según ese tipo (Configuración > Personalización). |
| `supabase_offline_sync.sql` | Columna `uuid` en ventas y caja para sincronizar sin duplicar al recuperar conexión. |
| `supabase_whatsapp_vendedor.sql` | Guarda el Phone Number ID de WhatsApp Business para el vendedor automático. |
| `supabase_suscripciones.sql` | Estado del plan (free/plus) y datos de Stripe. Ver [más arriba](#corestock-plus-suscripciones-con-stripe-opcional). |

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
