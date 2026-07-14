import Stripe from "stripe";

// Cliente de Stripe para uso EXCLUSIVO del servidor (rutas de app/api/**).
// Nunca importar este archivo desde un componente "use client".
let stripe: Stripe | null = null;

export function obtenerStripe(): Stripe {
  if (!stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new Error(
        "Falta STRIPE_SECRET_KEY. Defínela como variable de entorno del servidor (nunca con prefijo NEXT_PUBLIC_)."
      );
    }

    stripe = new Stripe(secretKey);
  }

  return stripe;
}
