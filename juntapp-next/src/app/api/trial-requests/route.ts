import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidChileLocation } from '@/lib/chile-locations';
import { trialRequestReceivedTemplate } from '@/lib/email-templates';
import { sendEmailBestEffort } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';
import { requestClientKey } from '@/lib/request-client-key';
import { createAdminClient } from '@/lib/supabase/admin';

const schema = z.object({
  contactName: z.string().trim().min(3).max(160),
  email: z.email().trim().toLowerCase(),
  phone: z.string().trim().max(40).refine((value) => /^(?:56)?9\d{8}$/.test(value.replace(/\D/g, '')), 'Celular inválido'),
  boardRole: z.enum(['presidente', 'secretario', 'tesorero', 'dirigente', 'otro']),
  juntaName: z.string().trim().min(3).max(160),
  region: z.string().trim().min(2).max(100),
  comuna: z.string().trim().min(2).max(100),
  memberCount: z.union([z.coerce.number().int().min(1).max(100000), z.null()]).optional(),
  requestedPlan: z.enum(['juntapp', 'juntapp_web', 'web']),
  message: z.string().trim().max(800).nullable().optional(),
  website: z.string().max(200).optional(),
  consent: z.literal(true),
  source: z.string().trim().max(80).optional(),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
  utmContent: z.string().trim().max(120).optional(),
}).refine((data) => isValidChileLocation(data.region, data.comuna), { message: 'La región y comuna no corresponden.', path: ['comuna'] });

export async function POST(request: Request) {
  const clientKey = requestClientKey(request);
  if (!(await rateLimit(`trial-request:${clientKey}`, 5, 60 * 60 * 1000)).allowed) {
    return NextResponse.json({ error: 'Ya recibimos varias solicitudes desde esta conexión. Intenta más tarde.' }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Revisa los datos ingresados.' }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const { data: existing } = await admin.from('trial_requests').select('id').ilike('email', parsed.data.email).in('status', ['new', 'contacted']).limit(1).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, duplicate: true });

  const { data: createdRequest, error } = await admin.from('trial_requests').insert({
    contact_name: parsed.data.contactName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    board_role: parsed.data.boardRole,
    junta_name: parsed.data.juntaName,
    region: parsed.data.region,
    comuna: parsed.data.comuna,
    member_count: parsed.data.memberCount ?? null,
    requested_plan: parsed.data.requestedPlan,
    message: parsed.data.message || null,
    source: parsed.data.source || null,
    utm_source: parsed.data.utmSource || null,
    utm_medium: parsed.data.utmMedium || null,
    utm_campaign: parsed.data.utmCampaign || null,
    utm_content: parsed.data.utmContent || null,
  }).select('id').single();
  if (error) return NextResponse.json({ error: 'No fue posible guardar la solicitud. Intenta nuevamente.' }, { status: 500 });

  const confirmation = trialRequestReceivedTemplate({ name: parsed.data.contactName, juntaName: parsed.data.juntaName });
  await sendEmailBestEffort({
    to: parsed.data.email,
    ...confirmation,
    idempotencyKey: `trial-request-received:${createdRequest.id}`,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

