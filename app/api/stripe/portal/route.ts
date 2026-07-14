import { NextResponse } from "next/server";
import { obtenerStripe } from "../../../../lib/stripe";
import { obtenerSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { verificarUsuarioApi } from "../../../../lib/verificarUsuarioApi";

// Crea una sesión del Portal de Facturación de Stripe — ahí el usuario
// agrega/cambia su tarjeta, ve sus facturas o cancela su suscripción.
// CoreStock nunca guarda ni ve el número de tarjeta.
export async function POST(request: Request) {
  const user = await verificarUsuarioApi(request);

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    const stripe = obtenerStripe();
    const admin = obtenerSupabaseAdmin();

    const { data: empresa } = await admin
      .from("empresa_config")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const customerId = empresa?.stripe_customer_id as string | null;

    if (!customerId) {
      return NextResponse.json(
        { error: "Todavía no tienes una suscripción activa." },
        { status: 400 }
      );
    }

    const origin = request.headers.get("origin") ?? new URL(request.url).origin;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/suscripcion`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error(error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `No se pudo abrir el portal de facturación: ${detalle}` },
      { status: 500 }
    );
  }
}
