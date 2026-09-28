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
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  if (!(await rateLimit(`member-due-checkout:${user.id}`, 6, 60_000)).allowed) {
    return NextResponse.json({ error: 'Espera un momento antes de reintentar.' }, { status: 429 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, junta_id, household_id, name, email, address, juntas(id, name, monthly_due_amount)')
    .eq('id', user.id)
    .single();
  const junta = Array.isArray(profile?.juntas) ? profile.juntas[0] : profile?.juntas;
  if (!profile || !junta || !profile.household_id) return NextResponse.json({ error: 'Perfil, domicilio o junta no encontrados.' }, { status: 404 });

  try {
    const account = await getJuntaMercadoPagoAccount(profile.junta_id);
    if (!account) return NextResponse.json({ error: 'Tu junta todavía no conectó su cuenta de Mercado Pago.' }, { status: 409 });
    const period = `${currentChileBillingPeriod()}-01`;
    const admin = createAdminClient();
    const { data: existingDue } = await admin.from('member_dues').select('*').eq('household_id', profile.household_id).eq('period', period).maybeSingle();
    if (existingDue?.status === 'paid') return NextResponse.json({ error: 'La cuota de este domicilio ya está pagada.' }, { status: 409 });
    if (existingDue?.status === 'preference_created' && existingDue.checkout_url) {
      return NextResponse.json({ checkoutUrl: existingDue.checkout_url, dueId: existingDue.id });
    }

    const due = existingDue ?? (await admin.from('member_dues').insert({
      junta_id: profile.junta_id,
      household_id: profile.household_id,
      profile_id: user.id,
      period,
      amount: junta.monthly_due_amount,
      status: 'pending',
    }).select('*').single()).data;
    if (!due) throw new Error('No fue posible generar la cuota del mes.');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? new URL(request.url).origin;
    const webhookUrl = appUrl.startsWith('https://') && process.env.MERCADOPAGO_WEBHOOK_SECRET
      ? `${appUrl}/api/webhooks/mercadopago`
      : undefined;
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': due.id,
      },
      body: JSON.stringify({
        items: [{
          id: `due-${due.id}`,
          title: `Cuota vecinal ${period.slice(0, 7)} — ${junta.name}`,
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
      updated_at: new Date().toISOString(),
    }).eq('id', due.id);
    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ checkoutUrl, dueId: due.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No fue posible iniciar el pago.' }, { status: 502 });
  }
}
