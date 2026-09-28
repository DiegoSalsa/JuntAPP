import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';

const paymentSchema = z.object({
  eventId: z.string().min(1).max(200),
  juntaId: z.uuid(),
  description: z.string().trim().min(3).max(300),
  amount: z.number().positive().max(999_999_999),
  date: z.iso.date().optional(),
});

function signatureIsValid(body: string, receivedSignature: string | null, secret: string) {
  if (!receivedSignature) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const received = receivedSignature.replace(/^sha256=/, '');
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export async function POST(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!(await rateLimit(`payment:${forwardedFor}`, 60, 60_000)).allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }

  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!signatureIsValid(rawBody, request.headers.get('x-juntapp-signature'), secret)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = paymentSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Evento inválido', details: z.flattenError(parsed.error) }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { error: eventError } = await admin.from('payment_events').insert({
      provider_event_id: parsed.data.eventId,
      junta_id: parsed.data.juntaId,
      payload: parsed.data,
    });

    if (eventError?.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 400 });
    }

    const { error: transactionError } = await admin.from('transactions').insert({
      junta_id: parsed.data.juntaId,
      type: 'ingreso',
      description: parsed.data.description,
      amount: parsed.data.amount,
      date: parsed.data.date ?? new Date().toISOString().slice(0, 10),
      created_by: null,
    });

    if (transactionError) {
      await admin.from('payment_events').delete().eq('provider_event_id', parsed.data.eventId);
      return NextResponse.json({ error: transactionError.message }, { status: 400 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No fue posible procesar el evento.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
