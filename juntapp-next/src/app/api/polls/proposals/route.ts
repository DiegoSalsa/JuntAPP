import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { queuePushNotification } from '@/lib/web-push';

const schema = z.object({
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(10).max(2000),
  options: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  if (!(await rateLimit(`poll-proposal:${user.id}`, 5, 24 * 60 * 60_000)).allowed) return NextResponse.json({ error: 'Alcanzaste el límite diario de propuestas.' }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Revisa el título, contexto y alternativas.' }, { status: 400 });
  const { data: profile } = await supabase.from('profiles').select('id, junta_id, name').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Socio no encontrado.' }, { status: 404 });
  const options = parsed.data.options.map((text, index) => ({ id: `opt-${index + 1}`, text }));
  const admin = createAdminClient();
  const { data: proposal, error } = await admin.from('poll_proposals').insert({ junta_id: profile.junta_id, proposed_by: user.id, title: parsed.data.title, description: parsed.data.description, options }).select('*').single();
  if (error || !proposal) return NextResponse.json({ error: error?.message ?? 'No fue posible guardar la propuesta.' }, { status: 400 });
  const { data: board } = await admin.from('profiles').select('id').eq('junta_id', profile.junta_id).eq('role', 'dirigente');
  if (board?.length) {
    await admin.from('notifications').insert(board.map((member) => ({ user_id: member.id, type: 'propuesta', title: 'Nueva propuesta de consulta', message: `${profile.name} propuso: ${proposal.title}`, read: false, date: new Date().toISOString(), action: '/consultas' })));
    await queuePushNotification({ juntaId: profile.junta_id, eventKey: `proposal:${proposal.id}`, notificationType: 'propuesta', recipientUserIds: board.map((member) => member.id), title: 'Nueva propuesta de consulta', message: `${profile.name} propuso: ${proposal.title}`, action: '/consultas', tag: `proposal:${proposal.id}`, createdBy: user.id });
  }
  return NextResponse.json({ proposal }, { status: 201 });
}
