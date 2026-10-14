import type { Metadata } from 'next';
import VotacionesClient from '@/components/dashboard/votaciones/VotacionesClient';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Consultas — JuntAPP',
};

export default async function ConsultasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single();

  const { data: polls } = await supabase
    .from('polls')
    .select('*')
    .eq('junta_id', profile?.junta_id)
    .order('created_at', { ascending: false });

  const { data: proposals } = await supabase
    .from('poll_proposals')
    .select('*')
    .eq('junta_id', profile?.junta_id)
    .order('created_at', { ascending: false });

  const { data: pollOverview, error: pollOverviewError } = await supabase.rpc('poll_overview');
  if (pollOverviewError) console.error('[consultas] No fue posible obtener el resumen de votaciones', pollOverviewError);
  const overviewByPoll = new Map<string, { counts: Map<string, number>; hasVoted: boolean }>();
  for (const row of pollOverview ?? []) {
    const current = overviewByPoll.get(row.poll_id) ?? { counts: new Map<string, number>(), hasVoted: false };
    current.counts.set(row.option_id, Number(row.votes ?? 0));
    current.hasVoted = current.hasVoted || Boolean(row.has_voted);
    overviewByPoll.set(row.poll_id, current);
  }
  const enrichedPolls = (polls || []).map((poll) => {
    const overview = overviewByPoll.get(poll.id) ?? { counts: new Map<string, number>(), hasVoted: false };
    const options = (poll.options as { id: string; text: string }[]).map((option) => ({ ...option, votes: overview.counts.get(option.id) ?? 0 }));
    return { ...poll, options, hasVoted: overview.hasVoted };
  });

  return <VotacionesClient polls={enrichedPolls} currentProfile={profile!} proposals={proposals ?? []} />;
}
