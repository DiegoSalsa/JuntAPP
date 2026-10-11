import { currentChileBillingPeriod } from '@/lib/billing-period';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { publicAppUrl, sendEmailBestEffort } from '@/lib/email';
import { duePaymentTemplate } from '@/lib/email-templates';
import { sendPushToUsers } from '@/lib/web-push';

const manualDueSchema = z.object({
  householdId: z.uuid(),
  action: z.enum(['paid', 'pending']),
  method: z.enum(['cash', 'transfer', 'other']).optional(),
  periods: z.array(z.string().regex(/^\d{4}-\d{2}-01$/)).min(1).max(12).optional(),
}).refine((value) => value.action === 'pending' || Boolean(value.method), { message: 'Selecciona el medio de pago.' });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  if (!(await rateLimit(`manual-due:${user.id}`, 20, 60_000)).allowed) {
    return NextResponse.json({ error: 'Demasiados cambios seguidos. Espera un momento.' }, { status: 429 });
  }
  const parsed = manualDueSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Selecciona una acción y medio de pago válidos.' }, { status: 400 });
  const { data: currentProfile } = await supabase.from('profiles').select('junta_id, role, membership_status').eq('id', user.id).eq('membership_status', 'active').single();
  if (!currentProfile || currentProfile.role !== 'dirigente') {
    return NextResponse.json({ error: 'Solo la directiva puede registrar pagos manuales.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin.from('households').select('id, junta_id').eq('id', parsed.data.householdId).maybeSingle();
  if (!target || target.junta_id !== currentProfile.junta_id) {
    return NextResponse.json({ error: 'Domicilio no encontrado en tu junta.' }, { status: 404 });
  }
  const periods = [...new Set(parsed.data.periods ?? [`${currentChileBillingPeriod()}-01`])].sort();
  if (parsed.data.action === 'paid') {
    const { data: batchResult, error: batchError } = await admin.rpc('record_manual_due_payment_batch', {
      p_junta_id: currentProfile.junta_id,
      p_household_id: target.id,
      p_periods: periods,
      p_method: parsed.data.method,
      p_actor: user.id,
    });
    if (batchError) return NextResponse.json({ error: batchError.message }, { status: 409 });
    const [{ data: recipients }, { data: junta }] = await Promise.all([
      admin.from('profiles').select('id, name, email').eq('household_id', target.id).eq('membership_status', 'active'),
      admin.from('juntas').select('name, monthly_due_amount').eq('id', target.junta_id).single(),
    ]);
    const periodLabel = periods.map((period) => new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(period))).join(', ');
    await Promise.all((recipients ?? []).map((recipient) => {
      const template = duePaymentTemplate({
        name: recipient.name,
        juntaName: junta?.name ?? 'tu junta vecinal',
        period: periodLabel,
        amount: periods.length * Number(junta?.monthly_due_amount ?? 0),
        status: 'approved',
        paymentId: batchResult?.[0]?.transaction_id ? `MANUAL-${batchResult[0].transaction_id}` : null,
        actionUrl: `${publicAppUrl()}/tesoreria`,
      });
      return sendEmailBestEffort({ to: recipient.email, ...template, idempotencyKey: `manual-due-batch:${batchResult?.[0]?.batch_id ?? target.id}:${recipient.id}` });
    }));
    await sendPushToUsers((recipients ?? []).map((recipient) => recipient.id), {
      title: 'Cuotas del domicilio registradas',
      message: `La directiva confirmó ${periodLabel}.`,
      action: '/tesoreria',
      tag: `cuota-manual-batch:${batchResult?.[0]?.batch_id ?? target.id}`,
    });
    return NextResponse.json({ success: true, transactionId: batchResult?.[0]?.transaction_id ?? null, status: 'al_dia', periods });
  }
  const { data: transactionId, error } = parsed.data.action === 'pending'
    ? await admin.rpc('reverse_manual_household_dues', {
      p_household_id: target.id,
      p_junta_id: currentProfile.junta_id,
      p_periods: periods,
      p_actor: user.id,
    })
    : await admin.rpc('set_manual_household_due', {
      p_household_id: target.id,
      p_junta_id: currentProfile.junta_id,
      p_action: parsed.data.action,
      p_method: null,
    });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, transactionId, status: 'pendiente' });
}
