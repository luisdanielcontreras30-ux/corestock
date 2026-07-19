import { NextResponse } from "next/server";
import { obtenerStripe } from "../../../../lib/stripe";
import { obtenerSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { verificarUsuarioApi } from "../../../../lib/verificarUsuarioApi";

// Crea una sesión de Stripe Checkout para pasar a CoreStock Plus+.
// El cliente solo recibe la URL a la que redirigir — nunca toca datos
// de tarjeta directamente, eso lo maneja Stripe (PCI compliant).
export async function POST(request: Request) {
  const user = await verificarUsuarioApi(request);

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const priceId = process.env.STRIPE_PRICE_ID_PLUS;

  if (!priceId) {
    return NextResponse.json(
      { error: "Falta configurar STRIPE_PRICE_ID_PLUS en el servidor." },
      { status: 500 }
    );
  }

  try {
    const stripe = obtenerStripe();
    const admin = obtenerSupabaseAdmin();

    const { data: empresa } = await admin
      .from("empresa_config")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const origin = request.headers.get("origin") ?? new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: (empresa?.stripe_customer_id as string | null) ?? undefined,
      customer_email: empresa?.stripe_customer_id ? undefined : user.email ?? undefined,
      client_reference_id: user.id,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      success_url: `${origin}/suscripcion?estado=exito`,
      cancel_url: `${origin}/suscripcion?estado=cancelado`,
    });

    if (!session.url) {
      throw new Error("Stripe no devolvió una URL de checkout.");
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    // El detalle técnico (a veces texto crudo de la API de Stripe)
    // queda solo en los logs del servidor — al usuario le llega un
    // mensaje genérico, no información interna del proveedor de pagos.
    console.error(error);
    return NextResponse.json(
      { error: "No se pudo iniciar el proceso de pago. Intenta de nuevo en un momento." },
      { status: 500 }
    );
  }
}
