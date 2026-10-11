import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getJuntaMercadoPagoAccount } from '@/lib/mercadopago-connect';
import { rateLimit } from '@/lib/rate-limit';

const requestSchema = z.object({
  periods: z.array(z.string().regex(/^\d{4}-\d{2}-01$/)).min(1).max(12),
});

type PreferenceResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
  message?: string;
  cause?: { description?: string }[];
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  if (!(await rateLimit(`member-due-batch:${user.id}`, 6, 60_000)).allowed) {
    return NextResponse.json({ error: 'Espera un momento antes de reintentar.' }, { status: 429 });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Selecciona entre uno y doce períodos válidos.' }, { status: 400 });

  const periods = [...new Set(parsed.data.periods)].sort();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, junta_id, household_id, name, email, address, membership_status, juntas(id, name)')
    .eq('id', user.id)
    .eq('membership_status', 'active')
    .single();
  const junta = Array.isArray(profile?.juntas) ? profile.juntas[0] : profile?.juntas;
  if (!profile || !junta || !profile.household_id) {
    return NextResponse.json({ error: 'Tu cuenta no tiene un domicilio activo asociado.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const requestKey = `checkout:${periods.join(',')}`;
  const { data: batchId, error: batchError } = await admin.rpc('create_due_payment_batch', {
    p_junta_id: profile.junta_id,
    p_household_id: profile.household_id,
    p_periods: periods,
    p_request_key: requestKey,
    p_created_by: user.id,
  });
  if (batchError || !batchId) {
    return NextResponse.json({ error: batchError?.message ?? 'No fue posible preparar los períodos seleccionados.' }, { status: 409 });
  }

  try {
    const account = await getJuntaMercadoPagoAccount(profile.junta_id);
    if (!account) return NextResponse.json({ error: 'Tu junta todavía no conectó su cuenta de Mercado Pago.' }, { status: 409 });
    const { data: batch } = await admin
      .from('due_payment_batches')
      .select('id, total_amount, status, checkout_url, checkout_expires_at, checkout_attempt')
      .eq('id', batchId)
      .eq('household_id', profile.household_id)
      .single();
    if (!batch) return NextResponse.json({ error: 'No fue posible leer el lote de cobro.' }, { status: 409 });
    if (batch.status === 'approved') return NextResponse.json({ error: 'Los períodos seleccionados ya fueron pagados.' }, { status: 409 });
    if (batch.status === 'preference_created' && batch.checkout_url && batch.checkout_expires_at && new Date(batch.checkout_expires_at).getTime() > Date.now()) {
      return NextResponse.json({ checkoutUrl: batch.checkout_url, batchId: batch.id, total: Number(batch.total_amount), periods });
    }

    if (batch.status === 'preference_created') {
      return NextResponse.json({ error: 'Ya existe un intento de cobro en proceso. Espera unos segundos y vuelve a consultar.' }, { status: 409 });
    }
    const attempt = Number(batch.checkout_attempt ?? 0) + 1;
    const { data: claimedBatch, error: claimError } = await admin
      .from('due_payment_batches')
      .update({ status: 'preference_created', checkout_attempt: attempt, checkout_url: null, checkout_expires_at: null, updated_at: new Date().toISOString() })
      .eq('id', batch.id)
      .eq('checkout_attempt', Number(batch.checkout_attempt ?? 0))
      .in('status', ['pending', 'rejected', 'refunded'])
      .select('id, total_amount, status, checkout_attempt')
      .maybeSingle();
    if (claimError || !claimedBatch) {
      return NextResponse.json({ error: 'Otro intento está preparando este cobro. Espera unos segundos y vuelve a intentar.' }, { status: 409 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? new URL(request.url).origin;
    const webhookUrl = appUrl.startsWith('https://') && process.env.MERCADOPAGO_WEBHOOK_SECRET
      ? `${appUrl}/api/webhooks/mercadopago`
      : undefined;
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${batch.id}:${attempt}`,
      },
      body: JSON.stringify({
        items: [{
          id: `due-batch-${batch.id}`,
          title: `Cuotas vecinales (${periods.length} períodos) — ${junta.name}`,
          description: `Cuotas del domicilio ${profile.address}: ${periods.map((period) => period.slice(0, 7)).join(', ')}`,
          quantity: 1,
          currency_id: 'CLP',
          unit_price: Number(batch.total_amount),
        }],
        payer: { email: profile.email },
        external_reference: `juntapp-due-batch:${batch.id}:${profile.junta_id}:${profile.household_id}`,
        back_urls: {
          success: `${appUrl}/api/dues/return?result=approved&batch=${batch.id}`,
          pending: `${appUrl}/api/dues/return?result=pending&batch=${batch.id}`,
          failure: `${appUrl}/api/dues/return?result=failure&batch=${batch.id}`,
        },
        ...(appUrl.startsWith('https://') ? { auto_return: 'approved' } : {}),
        statement_descriptor: 'JUNTAPP CUOTAS',
        metadata: { purpose: 'household_due_batch', batch_id: batch.id, junta_id: profile.junta_id, household_id: profile.household_id, periods },
        ...(webhookUrl ? { notification_url: webhookUrl } : {}),
      }),
      cache: 'no-store',
    });
    const preference = await response.json() as PreferenceResponse;
    const checkoutUrl = account.access_token.startsWith('TEST-')
      ? preference.sandbox_init_point ?? preference.init_point
      : preference.init_point;
    if (!response.ok || !preference.id || !checkoutUrl) {
      throw new Error(preference.cause?.[0]?.description ?? preference.message ?? 'Mercado Pago no pudo crear el cobro.');
    }
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const { error: updateError } = await admin.from('due_payment_batches').update({
      status: 'preference_created',
      mercadopago_preference_id: preference.id,
      checkout_url: checkoutUrl,
      checkout_expires_at: expiresAt,
      checkout_attempt: attempt,
      updated_at: new Date().toISOString(),
    }).eq('id', batch.id).eq('checkout_attempt', attempt).eq('status', 'preference_created');
    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ checkoutUrl, batchId: batch.id, total: Number(batch.total_amount), periods });
  } catch (error) {
    await admin.from('due_payment_batches').update({ status: 'pending', checkout_url: null, checkout_expires_at: null, updated_at: new Date().toISOString() }).eq('id', batchId).eq('status', 'preference_created');
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No fue posible iniciar el pago.' }, { status: 502 });
  }
}
