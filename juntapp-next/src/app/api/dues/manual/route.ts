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
  const { data: currentProfile } = await supabase.from('profiles').select('junta_id, role').eq('id', user.id).single();
  if (!currentProfile || currentProfile.role !== 'dirigente') {
    return NextResponse.json({ error: 'Solo la directiva puede registrar pagos manuales.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin.from('households').select('id, junta_id').eq('id', parsed.data.householdId).maybeSingle();
  if (!target || target.junta_id !== currentProfile.junta_id) {
    return NextResponse.json({ error: 'Domicilio no encontrado en tu junta.' }, { status: 404 });
  }
  const period = `${currentChileBillingPeriod()}-01`;
  const { data: due } = await admin.from('member_dues').select('status, mercadopago_payment_id').eq('household_id', target.id).eq('period', period).maybeSingle();
  if (due?.status === 'paid' && due.mercadopago_payment_id) {
    return NextResponse.json({ error: 'Esta cuota fue confirmada por Mercado Pago y está protegida contra cambios manuales.' }, { status: 409 });
  }

  const { data: transactionId, error } = await admin.rpc('set_manual_household_due', {
    p_household_id: target.id,
    p_junta_id: currentProfile.junta_id,
    p_action: parsed.data.action,
    p_method: parsed.data.action === 'paid' ? parsed.data.method : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (parsed.data.action === 'paid') {
    const [{ data: recipients }, { data: junta }, { data: updatedDue }] = await Promise.all([
      admin.from('profiles').select('id, name, email').eq('household_id', target.id),
      admin.from('juntas').select('name').eq('id', target.junta_id).single(),
      admin.from('member_dues').select('amount').eq('household_id', target.id).eq('period', period).single(),
    ]);
    await Promise.all((recipients ?? []).map((recipient) => {
      const template = duePaymentTemplate({
        name: recipient.name,
        juntaName: junta?.name ?? 'tu junta vecinal',
        period: new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(period)),
        amount: Number(updatedDue?.amount ?? 0),
        status: 'approved',
        paymentId: transactionId ? `MANUAL-${transactionId}` : null,
        actionUrl: `${publicAppUrl()}/tesoreria`,
      });
      return sendEmailBestEffort({
        to: recipient.email,
        ...template,
        idempotencyKey: `manual-due-paid:${transactionId ?? `${target.id}:${period}`}:${recipient.id}`,
      });
    }));
    await sendPushToUsers((recipients ?? []).map((recipient) => recipient.id), {
      title: 'Cuota del domicilio registrada',
      message: `La directiva confirmó la cuota de ${new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(period))}.`,
      action: '/tesoreria',
      tag: `cuota-manual:${target.id}:${period}`,
    });
  }
  return NextResponse.json({ success: true, transactionId, status: parsed.data.action === 'paid' ? 'al_dia' : 'pendiente' });
}
