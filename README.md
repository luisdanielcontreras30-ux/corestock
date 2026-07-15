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
