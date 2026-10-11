import { currentChileBillingPeriod } from '@/lib/billing-period';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getJuntaMercadoPagoAccount } from '@/lib/mercadopago-connect';
import { rateLimit } from '@/lib/rate-limit';

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
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesiÃ³n.' }, { status: 401 });
  if (!(await rateLimit(`member-due-checkout:${user.id}`, 6, 60_000)).allowed) {
    return NextResponse.json({ error: 'Espera un momento antes de reintentar.' }, { status: 429 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, junta_id, household_id, name, email, address, membership_status, juntas(id, name, monthly_due_amount)')
    .eq('id', user.id)
    .eq('membership_status', 'active')
    .single();
  const junta = Array.isArray(profile?.juntas) ? profile.juntas[0] : profile?.juntas;
  if (!profile || !junta || !profile.household_id) return NextResponse.json({ error: 'Perfil, domicilio o junta no encontrados.' }, { status: 404 });

  let claimedDueId: string | null = null;
  try {
    const account = await getJuntaMercadoPagoAccount(profile.junta_id);
    if (!account) return NextResponse.json({ error: 'Tu junta todavÃ­a no conectÃ³ su cuenta de Mercado Pago.' }, { status: 409 });
    const period = `${currentChileBillingPeriod()}-01`;
    const admin = createAdminClient();
    const { data: existingDue } = await admin.from('member_dues').select('*').eq('household_id', profile.household_id).eq('period', period).maybeSingle();
    if (existingDue?.status === 'paid') return NextResponse.json({ error: 'La cuota de este domicilio ya estÃ¡ pagada.' }, { status: 409 });
    if (existingDue?.status === 'preference_created' && existingDue.checkout_url && new Date(existingDue.checkout_expires_at ?? new Date(new Date(existingDue.updated_at).getTime() + 30 * 60_000)).getTime() > Date.now()) {
      return NextResponse.json({ checkoutUrl: existingDue.checkout_url, dueId: existingDue.id });
    }

    let due = existingDue ?? (await admin.from('member_dues').insert({
      junta_id: profile.junta_id,
      household_id: profile.household_id,
      profile_id: user.id,
      period,
      amount: junta.monthly_due_amount,
      status: 'pending',
    }).select('*').single()).data;
    if (!due) throw new Error('No fue posible generar la cuota del mes.');
    if (due.status === 'preference_created') {
      const { error: resetError } = await admin.from('member_dues').update({ status: 'pending', checkout_url: null, mercadopago_preference_id: null, checkout_expires_at: null, updated_at: new Date().toISOString() }).eq('id', due.id).eq('status', 'preference_created');
      if (resetError) throw new Error(resetError.message);
      due = { ...due, status: 'pending', checkout_url: null, mercadopago_preference_id: null, checkout_attempt: Number(due.checkout_attempt ?? 0) };
    }
    const checkoutAttempt = Number(due.checkout_attempt ?? 0) + 1;
    const { data: claimedDue, error: claimError } = await admin
      .from('member_dues')
      .update({ status: 'preference_created', checkout_attempt: checkoutAttempt, checkout_url: null, checkout_expires_at: null, updated_at: new Date().toISOString() })
      .eq('id', due.id)
      .eq('checkout_attempt', Number(due.checkout_attempt ?? 0))
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();
    if (claimError || !claimedDue) return NextResponse.json({ error: 'Otro intento estÃ¡ preparando este cobro. Espera unos segundos y vuelve a intentar.' }, { status: 409 });
    due = claimedDue;
    claimedDueId = due.id;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? new URL(request.url).origin;
    const webhookUrl = appUrl.startsWith('https://') && process.env.MERCADOPAGO_WEBHOOK_SECRET
      ? `${appUrl}/api/webhooks/mercadopago`
      : undefined;
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${due.id}:${checkoutAttempt}`,
      },
      body: JSON.stringify({
        items: [{
          id: `due-${due.id}`,
          title: `Cuota vecinal ${period.slice(0, 7)} â€” ${junta.name}`,
          description: `Cuota mensual del domicilio ${profile.address}`,
          quantity: 1,
          currency_id: 'CLP',
          unit_price: Number(due.amount),
        }],
        payer: { email: profile.email },
        external_reference: `juntapp-due:${due.id}:${profile.junta_id}:${profile.household_id}`,
        back_urls: {
          success: `${appUrl}/api/dues/return?result=approved`,
          pending: `${appUrl}/api/dues/return?result=pending`,
          failure: `${appUrl}/api/dues/return?result=failure`,
        },
        ...(appUrl.startsWith('https://') ? { auto_return: 'approved' } : {}),
        statement_descriptor: 'JUNTAPP CUOTA',
        metadata: { purpose: 'household_due', due_id: due.id, junta_id: profile.junta_id, household_id: profile.household_id, payer_profile_id: user.id },
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
    const { error: updateError } = await admin.from('member_dues').update({
      status: 'preference_created',
      mercadopago_preference_id: preference.id,
      checkout_url: checkoutUrl,
      checkout_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      checkout_attempt: checkoutAttempt,
      updated_at: new Date().toISOString(),
    }).eq('id', due.id).eq('checkout_attempt', checkoutAttempt).eq('status', 'preference_created');
    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ checkoutUrl, dueId: due.id });
  } catch (error) {
    if (claimedDueId) await createAdminClient().from('member_dues').update({ status: 'pending', checkout_url: null, checkout_expires_at: null, updated_at: new Date().toISOString() }).eq('id', claimedDueId).eq('status', 'preference_created');
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No fue posible iniciar el pago.' }, { status: 502 });
  }
}
