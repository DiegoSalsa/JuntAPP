import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { processPendingPushJobs, queuePushNotification } from '@/lib/web-push';

const schema = z.object({
  category: z.enum(['urgente', 'asamblea', 'beneficio', 'general']),
  title: z.string().trim().min(5).max(160),
  content: z.string().trim().min(10).max(4000),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  if (!(await rateLimit(`announcement:${user.id}`, 10, 60_000)).allowed) {
    return NextResponse.json({ error: 'Espera un momento antes de publicar otro aviso.' }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Revisa la categoría, título y mensaje.' }, { status: 400 });
  const { data: profile } = await supabase.from('profiles').select('id, junta_id, role, name').eq('id', user.id).single();
  if (!profile || profile.role !== 'dirigente') return NextResponse.json({ error: 'Solo la directiva puede publicar.' }, { status: 403 });

  const admin = createAdminClient();
  const { data: announcement, error } = await admin.from('announcements').insert({
    junta_id: profile.junta_id,
    category: parsed.data.category,
    title: parsed.data.title,
    content: parsed.data.content,
    author: profile.name,
    date: new Date().toISOString().slice(0, 10),
  }).select('id').single();
  if (error || !announcement) return NextResponse.json({ error: error?.message ?? 'No fue posible publicar.' }, { status: 400 });

  const { data: recipients } = await admin.from('profiles').select('id').eq('junta_id', profile.junta_id);
  const userIds = (recipients ?? []).map((recipient) => recipient.id);
  const notificationType = parsed.data.category === 'asamblea' ? 'asamblea' : parsed.data.category === 'urgente' ? 'seguridad' : 'general';
  if (userIds.length) {
    await admin.from('notifications').insert(userIds.map((userId) => ({
      user_id: userId,
      type: notificationType,
      title: parsed.data.title,
      message: parsed.data.content.slice(0, 500),
      action: '/comunicaciones',
      read: false,
      date: new Date().toISOString(),
    })));
  }
  const push = await queuePushNotification({
    juntaId: profile.junta_id,
    eventKey: `announcement:${announcement.id}`,
    notificationType,
    recipientUserIds: userIds,
    title: parsed.data.title,
    message: parsed.data.content.slice(0, 500),
    action: '/comunicaciones',
    tag: `announcement:${announcement.id}`,
    createdBy: user.id,
  });
  after(() => processPendingPushJobs(3));
  return NextResponse.json({
    announcementId: announcement.id,
    notifiedUsers: userIds.length,
    pushJobId: push?.id ?? null,
    pushStatus: push?.status ?? 'pending',
    pushDelivered: push?.delivered_count ?? 0,
    pushSubscriptions: push?.subscription_count ?? 0,
    pushFailed: push?.failed_count ?? 0,
  }, { status: 201 });
}
