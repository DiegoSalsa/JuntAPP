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

type PaymentSearchResponse = {
  results?: Array<{ id?: number; status?: string; transaction_amount?: number; currency_id?: string; collector?: { id?: number } }>;
};

type PreferenceLookupResponse = {
  preference_expired?: boolean;
  expiration_date_from?: string;
  expiration_date_to?: string;
  collector_id?: number;
  message?: string;
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
  const baseRequestKey = `checkout:${periods.join(',')}`;
  const { data: priorBatch } = await admin.from('due_payment_batches')
    .select('status').eq('junta_id', profile.junta_id).eq('household_id', profile.household_id)
    .like('request_key', `${baseRequestKey}%`).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const requestKey = priorBatch && ['rejected', 'refunded', 'expired', 'reversed'].includes(priorBatch.status)
    ? `${baseRequestKey}:retry:${crypto.randomUUID()}`
    : baseRequestKey;
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
      .select('id, total_amount, status, checkout_url, checkout_expires_at, checkout_attempt, mercadopago_preference_id')
      .eq('id', batchId)
      .eq('household_id', profile.household_id)
      .single();
    if (!batch) return NextResponse.json({ error: 'No fue posible leer el lote de cobro.' }, { status: 409 });
    if (batch.status === 'approved') return NextResponse.json({ error: 'Los períodos seleccionados ya fueron pagados.' }, { status: 409 });
    if (batch.status === 'preference_created' && batch.checkout_url && batch.checkout_expires_at && new Date(batch.checkout_expires_at).getTime() > Date.now()) {
      return NextResponse.json({ checkoutUrl: batch.checkout_url, batchId: batch.id, total: Number(batch.total_amount), periods });
    }

    const expired = batch.status === 'preference_created'
      && (!batch.checkout_expires_at || new Date(batch.checkout_expires_at).getTime() <= Date.now());
    let resolvedPreferenceId: string | null = null;
    if (expired && !batch.mercadopago_preference_id) {
      return NextResponse.json({ error: 'El intento anterior no tiene una preferencia de Mercado Pago verificable.' }, { status: 409 });
    }
    if (expired && batch.mercadopago_preference_id) {
      const preferenceResponse = await fetch(`https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(batch.mercadopago_preference_id)}`, {
        headers: { Authorization: `Bearer ${account.access_token}` },
        cache: 'no-store',
      });
      const preferenceDetails = await preferenceResponse.json() as PreferenceLookupResponse;
      if (!preferenceResponse.ok) return NextResponse.json({ error: 'No fue posible verificar la vigencia de la preferencia anterior en Mercado Pago.' }, { status: 502 });
      const providerExpired = preferenceDetails.preference_expired === true
        || Boolean(preferenceDetails.expiration_date_to && new Date(preferenceDetails.expiration_date_to).getTime() <= Date.now());
      if (!providerExpired) return NextResponse.json({ error: 'La preferencia anterior aún está vigente en Mercado Pago. Espera su expiración antes de renovar.' }, { status: 409 });
      const searchUrl = new URL('https://api.mercadopago.com/v1/payments/search');
      searchUrl.searchParams.set('external_reference', `juntapp-due-batch:${batch.id}:${profile.junta_id}:${profile.household_id}`);
      searchUrl.searchParams.set('sort', 'date_created');
      searchUrl.searchParams.set('criteria', 'desc');
      searchUrl.searchParams.set('limit', '50');
      const searchResponse = await fetch(searchUrl, { headers: { Authorization: `Bearer ${account.access_token}` }, cache: 'no-store' });
      const payments = await searchResponse.json() as PaymentSearchResponse;
      if (!searchResponse.ok) return NextResponse.json({ error: 'No fue posible resolver el intento vencido con Mercado Pago.' }, { status: 502 });
      const live = (payments.results ?? []).find((payment) => ['approved', 'pending', 'in_process', 'authorized'].includes(payment.status ?? ''));
      if (live?.status && ['pending', 'in_process', 'authorized'].includes(live.status)) {
        return NextResponse.json({ error: 'El intento anterior aún está abierto en Mercado Pago. Espera su resolución antes de renovar.' }, { status: 409 });
      }
      const approved = (payments.results ?? []).find((payment) => payment.status === 'approved');
      if (approved?.id) {
        if (Number(approved.transaction_amount) !== Number(batch.total_amount) || approved.currency_id !== 'CLP' || Number(approved.collector?.id) !== Number(account.mercadopago_user_id)) {
          return NextResponse.json({ error: 'Mercado Pago reportó un importe, moneda o cobrador incompatible.' }, { status: 409 });
        }
        const { error: approvalError } = await admin.rpc('record_approved_due_payment_batch', {
          p_batch_id: batch.id, p_payment_id: String(approved.id), p_paid_at: new Date().toISOString(),
        });
        if (approvalError) return NextResponse.json({ error: approvalError.message }, { status: 409 });
        return NextResponse.json({ error: 'El intento anterior fue confirmado; los períodos ya están pagados.' }, { status: 409 });
      }
      resolvedPreferenceId = batch.mercadopago_preference_id;
    }
    const { data: claimResult, error: claimError } = await admin.rpc('claim_due_batch_checkout', {
      p_batch_id: batch.id,
      p_resolved_preference_id: resolvedPreferenceId,
    });
    if (claimError || !claimResult || claimResult.ready) {
      if (claimResult?.ready && claimResult.checkout_url) return NextResponse.json({ checkoutUrl: claimResult.checkout_url, batchId: batch.id, total: Number(batch.total_amount), periods });
      return NextResponse.json({ error: claimError?.message ?? 'Otro intento está preparando este cobro. Espera unos segundos y vuelve a intentar.' }, { status: 409 });
    }
    const attempt = Number(claimResult.attempt);
    const expirationDateFrom = new Date();
    const expirationDateTo = new Date(expirationDateFrom.getTime() + 30 * 60_000);
    const expiresAt = expirationDateTo.toISOString();
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
        expires: true,
        expiration_date_from: expirationDateFrom.toISOString(),
        expiration_date_to: expiresAt,
        back_urls: {
          success: `${appUrl}/api/dues/return?result=approved&batch=${batch.id}`,
          pending: `${appUrl}/api/dues/return?result=pending&batch=${batch.id}`,
          failure: `${appUrl}/api/dues/return?result=failure&batch=${batch.id}`,
        },
        ...(appUrl.startsWith('https://') ? { auto_return: 'approved' } : {}),
        statement_descriptor: 'JUNTAPP CUOTAS',
        metadata: { purpose: 'household_due_batch', batch_id: batch.id, checkout_attempt: attempt, junta_id: profile.junta_id, household_id: profile.household_id, periods },
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
    const { error: updateError } = await admin.rpc('complete_due_batch_checkout', {
      p_batch_id: batch.id,
      p_attempt: attempt,
      p_preference_id: preference.id,
      p_url: checkoutUrl,
      p_expires_at: expiresAt,
    });
    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ checkoutUrl, batchId: batch.id, total: Number(batch.total_amount), periods });
  } catch (error) {
    // Keep the creating lease when the provider call is uncertain. A retry after
    // the lease uses the same provider idempotency key, so it cannot create a
    // second checkout for the same attempt.
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No fue posible iniciar el pago.' }, { status: 502 });
  }
}
