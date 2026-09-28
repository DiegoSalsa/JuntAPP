import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { queuePushNotification } from '@/lib/web-push';

const schema = z.object({ decision: z.enum(['approve', 'reject']), reason: z.string().trim().max(500).optional() })
  .refine((value) => value.decision === 'approve' || Boolean(value.reason), { message: 'Indica el motivo del rechazo.' });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const proposalId = (await params).id;
  if (!z.uuid().safeParse(proposalId).success) return NextResponse.json({ error: 'Propuesta inválida.' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  if (!(await rateLimit(`poll-proposal-review:${user.id}`, 20, 60_000)).allowed) return NextResponse.json({ error: 'Espera antes de revisar otra propuesta.' }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'La decisión no es válida.' }, { status: 400 });
  const { data: reviewer } = await supabase.from('profiles').select('id, junta_id, role').eq('id', user.id).single();
  if (!reviewer || reviewer.role !== 'dirigente') return NextResponse.json({ error: 'Solo la directiva puede revisar propuestas.' }, { status: 403 });
  const admin = createAdminClient();
  const { data: proposal } = await admin.from('poll_proposals').select('*').eq('id', proposalId).eq('junta_id', reviewer.junta_id).maybeSingle();
  if (!proposal) return NextResponse.json({ error: 'Propuesta no encontrada.' }, { status: 404 });
  if (proposal.status !== 'pending') return NextResponse.json({ error: 'La propuesta ya fue revisada.' }, { status: 409 });
  const now = new Date().toISOString();
  if (parsed.data.decision === 'reject') {
    const { error } = await admin.from('poll_proposals').update({ status: 'rejected', reviewed_by: user.id, reviewed_at: now, rejection_reason: parsed.data.reason, updated_at: now }).eq('id', proposal.id).eq('status', 'pending');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await admin.from('notifications').insert({ user_id: proposal.proposed_by, type: 'propuesta', title: 'Propuesta revisada', message: `La directiva rechazó “${proposal.title}”: ${parsed.data.reason}`, read: false, date: now, action: '/consultas' });
    await queuePushNotification({ juntaId: reviewer.junta_id, eventKey: `proposal:${proposal.id}:rejected`, notificationType: 'propuesta', recipientUserIds: [proposal.proposed_by], title: 'Propuesta revisada', message: `La directiva rechazó “${proposal.title}”.`, action: '/consultas', tag: `proposal:${proposal.id}:rejected`, createdBy: user.id });
    return NextResponse.json({ status: 'rejected' });
  }
  const { data: activePoll } = await admin.from('polls').select('id').eq('junta_id', reviewer.junta_id).eq('active', true).maybeSingle();
  if (activePoll) return NextResponse.json({ error: 'Ya existe una consulta activa. Ciérrala antes de aprobar y publicar esta propuesta.' }, { status: 409 });
  const { data: poll, error: pollError } = await admin.from('polls').insert({ junta_id: reviewer.junta_id, title: proposal.title, description: proposal.description, options: proposal.options, active: true }).select('id').single();
  if (pollError || !poll) return NextResponse.json({ error: pollError?.message ?? 'No fue posible publicar la consulta.' }, { status: 400 });
  const { error: updateError } = await admin.from('poll_proposals').update({ status: 'approved', reviewed_by: user.id, reviewed_at: now, poll_id: poll.id, rejection_reason: null, updated_at: now }).eq('id', proposal.id).eq('status', 'pending');
  if (updateError) { await admin.from('polls').delete().eq('id', poll.id); return NextResponse.json({ error: updateError.message }, { status: 400 }); }
  const { data: members } = await admin.from('profiles').select('id').eq('junta_id', reviewer.junta_id);
  if (members?.length) {
    await admin.from('notifications').insert(members.map((member) => ({ user_id: member.id, type: 'votacion', title: 'Nueva consulta publicada', message: proposal.title, read: false, date: now, action: '/consultas' })));
    await queuePushNotification({ juntaId: reviewer.junta_id, eventKey: `poll:${poll.id}`, notificationType: 'votacion', recipientUserIds: members.map((member) => member.id), title: 'Nueva consulta publicada', message: proposal.title, action: '/consultas', tag: `poll:${poll.id}`, createdBy: user.id });
  }
  return NextResponse.json({ status: 'approved', pollId: poll.id });
}
