import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { processPendingPushJobs, queuePushNotification } from '@/lib/web-push';

const schema = z.object({
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(10).max(2000),
  options: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  if (!(await rateLimit(`poll-publish:${user.id}`, 10, 60_000)).allowed) return NextResponse.json({ error: 'Espera antes de publicar otra consulta.' }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Revisa el título, contexto y alternativas.' }, { status: 400 });
  const { data: profile } = await supabase.from('profiles').select('id, junta_id, role').eq('id', user.id).single();
  if (!profile || profile.role !== 'dirigente') return NextResponse.json({ error: 'Solo la directiva puede publicar consultas.' }, { status: 403 });
  const admin = createAdminClient();
  const { data: activePoll } = await admin.from('polls').select('id').eq('junta_id', profile.junta_id).eq('active', true).maybeSingle();
  if (activePoll) return NextResponse.json({ error: 'Cierra la consulta activa antes de publicar una nueva.' }, { status: 409 });
  const options = parsed.data.options.map((text, index) => ({ id: `opt-${index + 1}`, text }));
  const { data: poll, error } = await admin.from('polls').insert({
    title: parsed.data.title,
    description: parsed.data.description,
    junta_id: profile.junta_id,
    active: true,
    options,
  }).select('id').single();
  if (error || !poll) return NextResponse.json({ error: error?.message ?? 'No fue posible publicar la consulta.' }, { status: 400 });
  const { data: members } = await admin.from('profiles').select('id').eq('junta_id', profile.junta_id);
  const userIds = (members ?? []).map((member) => member.id);
  if (userIds.length) {
    await admin.from('notifications').insert(userIds.map((userId) => ({ user_id: userId, type: 'votacion', title: 'Nueva consulta publicada', message: parsed.data.title, read: false, date: new Date().toISOString(), action: '/consultas' })));
  }
  const push = await queuePushNotification({
    juntaId: profile.junta_id,
    eventKey: `poll:${poll.id}`,
    notificationType: 'votacion',
    recipientUserIds: userIds,
    title: 'Nueva consulta publicada',
    message: parsed.data.title,
    action: '/consultas',
    tag: `poll:${poll.id}`,
    createdBy: user.id,
  });
  after(() => processPendingPushJobs(3));
  return NextResponse.json({ pollId: poll.id, pushStatus: push?.status ?? 'pending', pushDelivered: push?.delivered_count ?? 0, pushSubscriptions: push?.subscription_count ?? 0 }, { status: 201 });
}
