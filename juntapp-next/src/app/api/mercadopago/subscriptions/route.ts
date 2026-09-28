import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  mercadoPagoApiHeaders,
  subscriptionExternalReference,
  syncMercadoPagoSubscription,
  type MercadoPagoSubscription,
} from '@/lib/mercadopago';
import { juntaHasActiveAccess } from '@/lib/junta-billing';
import { expireJuntaTrialIfNeeded } from '@/lib/junta-trial';
import { rateLimit } from '@/lib/rate-limit';

const subscriptionSchema = z.object({
  token: z.string().min(20).max(300),
  idempotencyKey: z.uuid(),
});

type MercadoPagoResponse = Partial<MercadoPagoSubscription> & {
  message?: string;
  cause?: { description?: string }[];
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  if (!(await rateLimit(`mercadopago-subscription:${user.id}`, 6, 60_000)).allowed) {
    return NextResponse.json({ error: 'Espera un momento antes de reintentar.' }, { status: 429 });
  }

  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Los datos de la tarjeta son inválidos.' }, { status: 400 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, role, juntas(*)')
    .eq('id', user.id)
    .single();
  const rawJunta = Array.isArray(profile?.juntas) ? profile.juntas[0] : profile?.juntas;
  if (!profile || !rawJunta) return NextResponse.json({ error: 'Registro pendiente no encontrado.' }, { status: 404 });
  const junta = await expireJuntaTrialIfNeeded(rawJunta);
  if (profile.role !== 'dirigente' || junta.owner_id !== user.id) {
    return NextResponse.json({ error: 'Solo quien creó la junta puede administrar su suscripción.' }, { status: 403 });
  }
  if (juntaHasActiveAccess(junta)) {
    return NextResponse.json({ subscriptionId: junta.mercadopago_subscription_id, status: 'authorized', active: true });
  }
  if (junta.mercadopago_subscription_id && junta.subscription_status !== 'cancelled') {
    try {
      const current = await syncMercadoPagoSubscription(junta.mercadopago_subscription_id, user.id);
      if (current.authorized) {
        return NextResponse.json({ subscriptionId: junta.mercadopago_subscription_id, status: 'authorized', active: true });
      }
    } catch {
      // The checkout below remains unavailable while Mercado Pago owns a live preapproval.
    }
    return NextResponse.json({ error: 'La suscripción existente aún está siendo procesada. Intenta nuevamente en unos minutos.' }, { status: 409 });
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? new URL(request.url).origin;
    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        ...mercadoPagoApiHeaders(),
        'X-Idempotency-Key': parsed.data.idempotencyKey,
      },
      body: JSON.stringify({
        reason: `Suscripción mensual JuntAPP — ${junta.name}`,
        external_reference: subscriptionExternalReference(junta.id, user.id),
        payer_email: process.env.MERCADOPAGO_ACCESS_TOKEN?.startsWith('TEST-')
          ? process.env.MERCADOPAGO_TEST_PAYER_EMAIL ?? profile.email
          : profile.email,
        card_token_id: parsed.data.token,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: Number(junta.subscription_price),
          currency_id: 'CLP',
        },
        back_url: `${appUrl}/registro/pago`,
        status: 'authorized',
      }),
      cache: 'no-store',
    });
    const raw = await response.text();
    const subscription = (raw ? JSON.parse(raw) : {}) as MercadoPagoResponse;
    if (!response.ok || !subscription.id) {
      const unavailable = response.status >= 500;
      return NextResponse.json({
        error: subscription.cause?.[0]?.description
          ?? subscription.message
          ?? (unavailable ? 'El entorno de suscripciones de Mercado Pago no está disponible temporalmente.' : `Mercado Pago rechazó la suscripción (HTTP ${response.status}).`),
      }, { status: unavailable ? 503 : 400 });
    }

    const verification = await syncMercadoPagoSubscription(subscription.id, user.id);
    if (!verification.authorized) {
      return NextResponse.json({
        subscriptionId: subscription.id,
        status: verification.status,
        error: 'Mercado Pago todavía no autorizó la suscripción.',
      }, { status: 402 });
    }
    return NextResponse.json({ subscriptionId: subscription.id, status: 'authorized', active: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No fue posible crear la suscripción.' }, { status: 502 });
  }
}
