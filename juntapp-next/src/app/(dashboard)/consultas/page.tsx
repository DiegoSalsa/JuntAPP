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

  const enrichedPolls = await Promise.all((polls || []).map(async (poll) => {
    const [{ data: results }, { data: participation }] = await Promise.all([
      supabase.rpc('poll_results', { p_poll_id: poll.id }),
      supabase.rpc('has_poll_participated', { p_poll_id: poll.id }),
    ]);
    const counts = new Map((results ?? []).map((row: { option_id: string; votes: number }) => [row.option_id, Number(row.votes)]));
    const options = (poll.options as { id: string; text: string }[]).map((option) => ({ ...option, votes: counts.get(option.id) ?? 0 }));
    return { ...poll, options, hasVoted: Boolean(participation) };
  }));

  return <VotacionesClient polls={enrichedPolls} currentProfile={profile!} proposals={proposals ?? []} />;
}
