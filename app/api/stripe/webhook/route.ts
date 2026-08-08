import { NextResponse } from "next/server";
import Stripe from "stripe";
import { obtenerStripe } from "../../../../lib/stripe";
import { obtenerSupabaseAdmin } from "../../../../lib/supabaseAdmin";

// Stripe firma cada evento con STRIPE_WEBHOOK_SECRET — verificamos esa
// firma contra el cuerpo crudo de la petición antes de confiar en nada
// de lo que llega aquí. Esta ruta no tiene sesión de usuario: por eso
// usa la service_role key (obtenerSupabaseAdmin) para escribir el
// estado de la suscripción directamente por stripe_customer_id.
export async function POST(request: Request) {
  const firma = request.headers.get("stripe-signature");
  const secretoWebhook = process.env.STRIPE_WEBHOOK_SECRET;

  if (!firma || !secretoWebhook) {
    return NextResponse.json(
      { error: "Falta la firma o STRIPE_WEBHOOK_SECRET." },
      { status: 400 }
    );
  }

  const cuerpoCrudo = await request.text();
  const stripe = obtenerStripe();

  let evento: Stripe.Event;

  try {
    evento = stripe.webhooks.constructEvent(cuerpoCrudo, firma, secretoWebhook);
  } catch (error) {
    console.error("Firma de webhook de Stripe inválida:", error);
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

  const admin = obtenerSupabaseAdmin();

  try {
    switch (evento.type) {
      // async_payment_succeeded va junto a completed a propósito: con
      // los métodos de pago diferido (OXXO, transferencia SPEI, débito
      // bancario — muy usados justo en el mercado de esta app), Stripe
      // manda completed con payment_status "unpaid" en cuanto se genera
      // el comprobante, y solo días después manda este otro evento si
      // el pago de verdad llegó.
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = evento.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        // Antes se daba Plus+ con solo ver el evento completed, sin
        // mirar si el pago se había cobrado: quien iniciaba un checkout
        // con OXXO obtenía el plan de inmediato con solo imprimir el
        // comprobante, aunque nunca fuera a pagarlo.
        const pagada =
          session.payment_status === "paid" ||
          session.payment_status === "no_payment_required";

        if (userId && customerId) {
          // upsert (no update): si el negocio todavía no había guardado
          // nada en Configuración → Empresa, no existe fila en
          // empresa_config para este usuario todavía — un update no
          // crea la fila y el pago se perdería en silencio.
          //
          // Cuando todavía no está pagada se guarda igual el
          // stripe_customer_id (sin tocar plan ni estado, que en una
          // fila nueva quedan en el 'free' por defecto): así los eventos
          // customer.subscription.* que lleguen después ya encuentran la
          // fila por customer_id, que es el desajuste de orden que
          // documenta el caso de abajo.
          const fila: Record<string, unknown> = {
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId ?? null,
          };

          if (pagada) {
            fila.plan = "plus";
            fila.suscripcion_estado = "active";
          }

          const { error: errorUpsert } = await admin
            .from("empresa_config")
            .upsert(fila, { onConflict: "user_id" });

          // Sin esto, un fallo al escribir dejaba a alguien que ya pagó
          // sin su plan y sin ningún rastro de por qué.
          if (errorUpsert) {
            console.error(
              `Webhook Stripe ${evento.type}: no se pudo guardar la suscripción de user_id=${userId}:`,
              errorUpsert
            );
          }
        }

        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subscription = evento.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

        const activa = ["active", "trialing"].includes(subscription.status);
        const periodoFin = subscription.items.data[0]?.current_period_end;

        const { data: actualizados, error: errorUpdate } = await admin
          .from("empresa_config")
          .update({
            plan: activa ? "plus" : "free",
            stripe_subscription_id: subscription.id,
            suscripcion_estado: subscription.status,
            suscripcion_periodo_fin: periodoFin
              ? new Date(periodoFin * 1000).toISOString()
              : null,
          })
          .eq("stripe_customer_id", customerId)
          .select("user_id");

        // Stripe no garantiza el orden de entrega — si este evento llega
        // antes que checkout.session.completed (que es el que primero
        // guarda stripe_customer_id), el update de arriba no encuentra
        // ninguna fila y el estado de la suscripción se pierde en
        // silencio para este evento. No hay nada seguro que "arreglar"
        // aquí sin la fila todavía, pero al menos queda registrado en
        // vez de fallar callado — el siguiente evento de Stripe (ej. la
        // renovación) sí lo persiste.
        if (!errorUpdate && actualizados?.length === 0) {
          console.error(
            `Webhook Stripe ${evento.type}: no se encontró empresa_config con stripe_customer_id=${customerId} (¿llegó antes que checkout.session.completed?)`
          );
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = evento.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

        const { data: actualizados, error: errorUpdate } = await admin
          .from("empresa_config")
          .update({
            plan: "free",
            suscripcion_estado: "canceled",
          })
          .eq("stripe_customer_id", customerId)
          .select("user_id");

        if (!errorUpdate && actualizados?.length === 0) {
          console.error(
            `Webhook Stripe ${evento.type}: no se encontró empresa_config con stripe_customer_id=${customerId}`
          );
        }

        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("Error procesando webhook de Stripe:", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }

  return NextResponse.json({ recibido: true });
}
