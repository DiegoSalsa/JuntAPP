import { currentChileBillingPeriodStart } from '@/lib/billing-period';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import InicioV2 from '@/components/dashboard/inicio/InicioV2';

export const metadata: Metadata = { title: 'Panel de Inicio — JuntAPP' };

export default async function InicioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*, juntas(name, owner_id)').eq('id', user!.id).single();
  const juntaId = profile?.junta_id;
  const period = currentChileBillingPeriodStart();
  const [sociosCountResult, { data: dueCounts, error: dueCountsError }, { data: myDue, error: myDueError }, { data: treasurySummary, error: treasuryError }, { data: announcements }, { data: activePolls, error: activePollsError }, { data: boardContacts }, { count: pendingApplications, error: pendingApplicationsError }, { count: pendingProposals, error: pendingProposalsError }] = await Promise.all([
    profile?.role === 'dirigente'
      ? supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('junta_id', juntaId)
      : Promise.resolve({ count: null, error: null }),
    supabase.rpc('junta_due_household_counts', { p_junta_id: juntaId, p_period: period }),
    supabase.from('member_dues').select('household_id').eq('junta_id', juntaId).eq('household_id', profile?.household_id).eq('period', period).eq('status', 'paid').maybeSingle(),
    supabase.rpc('treasury_summary', { p_junta_id: juntaId, p_from_date: null, p_to_date: null, p_type: null, p_source: null }),
    supabase.from('announcements').select('*').eq('junta_id', juntaId).order('created_at', { ascending: false }).limit(3),
    supabase.from('polls').select('id, title').eq('junta_id', juntaId).eq('active', true).order('created_at', { ascending: false }).limit(3),
    profile?.role === 'vecino' ? supabase.rpc('board_contacts', { p_junta_id: juntaId }) : Promise.resolve({ data: [] }),
    profile?.role === 'dirigente' ? supabase.from('membership_applications').select('id', { count: 'exact', head: true }).eq('junta_id', juntaId).eq('status', 'pending') : Promise.resolve({ count: 0, error: null }),
    profile?.role === 'dirigente' ? supabase.from('poll_proposals').select('id', { count: 'exact', head: true }).eq('junta_id', juntaId).eq('status', 'pending') : Promise.resolve({ count: 0, error: null }),
  ]);
  if (treasuryError) console.error('[inicio] No fue posible obtener el resumen de caja', treasuryError);
  if (dueCountsError) console.error('[inicio] No fue posible obtener el conteo de domicilios', dueCountsError);
  const treasuryRow = treasurySummary?.[0];
  const treasury = treasuryError || !treasuryRow ? null : { income: Number(treasuryRow.income ?? 0), expenses: Number(treasuryRow.expenses ?? 0), fees: Number(treasuryRow.fees ?? 0), balance: Number(treasuryRow.balance ?? 0) };
  const dueRow = dueCounts?.[0];
  const sociosCountError = 'error' in sociosCountResult ? sociosCountResult.error : null;
  const sociosCount = 'count' in sociosCountResult ? sociosCountResult.count : null;
  const paid = dueCountsError || !dueRow ? null : Number(dueRow.paid_households ?? 0);
  const totalHouseholds = dueCountsError || !dueRow ? null : Number(dueRow.total_households ?? 0);
  const myDuePaid = myDueError ? null : Boolean(myDue);
  const junta = (Array.isArray(profile?.juntas) ? profile.juntas[0] : profile?.juntas) ?? null;
  const month = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date());
  const urgent = announcements?.find((item) => item.category === 'urgente');

  return <InicioV2
    profile={profile!}
    junta={junta}
    month={month.charAt(0).toUpperCase() + month.slice(1)}
    announcements={announcements ?? []}
    urgent={urgent?.content}
    activePolls={activePolls ?? []}
    activePollsError={Boolean(activePollsError)}
    myDuePaid={myDuePaid}
    myDueError={Boolean(myDueError)}
    period={period}
    treasury={treasury}
    treasuryError={Boolean(treasuryError)}
    paidHouseholds={paid}
    totalHouseholds={totalHouseholds}
    sociosCount={profile?.role === 'dirigente' && !sociosCountError ? sociosCount : null}
    sociosCountError={Boolean(sociosCountError)}
    boardContacts={(boardContacts ?? []) as never[]}
    pendingApplications={pendingApplicationsError ? null : pendingApplications}
    pendingProposals={pendingProposalsError ? null : pendingProposals}
    canReviewApplications={profile?.role === 'dirigente' && (profile.board_position === 'presidente' || profile.board_position === 'secretario' || profile.id === junta?.owner_id)}
    canManageTreasury={profile?.role === 'dirigente'}
    canPublishPolls={profile?.role === 'dirigente'}
    canPublishAnnouncements={profile?.role === 'dirigente'}
  />;
}
