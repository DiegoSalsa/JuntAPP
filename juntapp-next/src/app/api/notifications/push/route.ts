import { currentChileBillingPeriod } from '@/lib/billing-period';
import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { publicAppUrl, sendEmailBestEffort } from '@/lib/email';
import { dueReminderTemplate } from '@/lib/email-templates';
import { processPendingPushJobs, queuePushNotification } from '@/lib/web-push';

const notificationSchema = z.object({
  type: z.enum(['asamblea', 'votacion', 'cuota', 'seguridad', 'general']),
  title: z.string().trim().min(3).max(160),
  message: z.string().trim().min(3).max(500),
  action: z.string().trim().max(250).nullable().optional(),
  onlyPending: z.boolean().optional(),
  eventKey: z.string().trim().min(3).max(240).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const limit = await rateLimit(`notifications:${user.id}`, 5, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    );
  }

  const parsed = notificationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: z.flattenError(parsed.error) }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, junta_id, role, juntas(name, monthly_due_amount)')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'dirigente') {
    return NextResponse.json({ error: 'Se requiere rol de dirigente' }, { status: 403 });
  }

  const { data: recipients, error: recipientsError } = await supabase
    .from('profiles')
    .select('id, household_id, name, email')
    .eq('junta_id', profile.junta_id);

  if (recipientsError) {
    return NextResponse.json({ error: recipientsError.message }, { status: 500 });
  }

  const period = `${currentChileBillingPeriod()}-01`;
  const { data: paidDues } = parsed.data.onlyPending ? await supabase.from('member_dues').select('household_id').eq('junta_id', profile.junta_id).eq('period', period).eq('status', 'paid') : { data: [] };
  const paidHouseholdIds = new Set((paidDues ?? []).map((due) => due.household_id));
  const pendingRecipients = (recipients ?? []).filter((recipient) => !parsed.data.onlyPending || !paidHouseholdIds.has(recipient.household_id));
  const rows = pendingRecipients.map((recipient) => ({
    user_id: recipient.id,
    type: parsed.data.type,
    title: parsed.data.title,
    message: parsed.data.message,
    action: parsed.data.action ?? null,
  }));

  if (rows.length) {
    const { error: insertError } = await supabase.from('notifications').insert(rows);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  const push = await queuePushNotification({
    juntaId: profile.junta_id,
    eventKey: parsed.data.eventKey ?? `manual:${parsed.data.type}:${user.id}:${Date.now()}`,
    notificationType: parsed.data.type,
    recipientUserIds: rows.map((row) => row.user_id),
    title: parsed.data.title,
    message: parsed.data.message,
    action: parsed.data.action ?? '/inicio',
    tag: `${parsed.data.type}:${profile.junta_id}`,
    createdBy: user.id,
  });
  after(() => processPendingPushJobs(3));

  if (parsed.data.type === 'cuota' && parsed.data.onlyPending) {
    const junta = Array.isArray(profile.juntas) ? profile.juntas[0] : profile.juntas;
    const periodLabel = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(period));
    const sentOn = new Date().toISOString().slice(0, 10);
    await Promise.all(pendingRecipients.map((recipient) => {
      const template = dueReminderTemplate({
        name: recipient.name,
        juntaName: junta?.name ?? 'tu junta vecinal',
        period: periodLabel,
        amount: Number(junta?.monthly_due_amount ?? 0),
        actionUrl: `${publicAppUrl()}${parsed.data.action ?? '/tesoreria'}`,
      });
      return sendEmailBestEffort({
        to: recipient.email,
        ...template,
        idempotencyKey: `due-reminder:${period}:${sentOn}:${recipient.id}`,
      });
    }));
  }

  return NextResponse.json({
    delivered: rows.length,
    pushJobId: push?.id ?? null,
    pushStatus: push?.status ?? 'pending',
    pushDelivered: push?.delivered_count ?? 0,
    pushSubscriptions: push?.subscription_count ?? 0,
    pushFailed: push?.failed_count ?? 0,
  });
}
