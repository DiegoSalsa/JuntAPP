import { currentChileBillingPeriodStart } from '@/lib/billing-period';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import InicioV2 from '@/components/dashboard/inicio/InicioV2';

export const metadata: Metadata = { title: 'Panel de Inicio — JuntAPP' };

export default async function InicioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*, juntas(name)').eq('id', user!.id).single();
  const juntaId = profile?.junta_id;
  const period = currentChileBillingPeriodStart();
  const [{ count: sociosCount }, { data: dueCounts, error: dueCountsError }, { data: myDue }, { data: treasurySummary, error: treasuryError }, { data: announcements }, { data: activePoll }, { data: boardContacts }, { count: pendingApplications }, { count: pendingProposals }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('junta_id', juntaId),
    supabase.rpc('junta_due_household_counts', { p_junta_id: juntaId, p_period: period }),
    supabase.from('member_dues').select('household_id').eq('junta_id', juntaId).eq('household_id', profile?.household_id).eq('period', period).eq('status', 'paid').maybeSingle(),
    supabase.rpc('treasury_summary', { p_junta_id: juntaId, p_from_date: null, p_to_date: null, p_type: null, p_source: null }),
    supabase.from('announcements').select('*').eq('junta_id', juntaId).order('created_at', { ascending: false }).limit(3),
    supabase.from('polls').select('title').eq('junta_id', juntaId).eq('active', true).maybeSingle(),
    profile?.role === 'vecino' ? supabase.rpc('board_contacts', { p_junta_id: juntaId }) : Promise.resolve({ data: [] }),
    profile?.role === 'dirigente' ? supabase.from('membership_applications').select('id', { count: 'exact', head: true }).eq('junta_id', juntaId).eq('status', 'pending') : Promise.resolve({ count: 0 }),
    profile?.role === 'dirigente' ? supabase.from('poll_proposals').select('id', { count: 'exact', head: true }).eq('junta_id', juntaId).eq('status', 'pending') : Promise.resolve({ count: 0 }),
  ]);
  if (treasuryError) console.error('[inicio] No fue posible obtener el resumen de caja', treasuryError);
  if (dueCountsError) console.error('[inicio] No fue posible obtener el conteo de domicilios', dueCountsError);
  const treasuryRow = treasurySummary?.[0];
  const treasury = treasuryError ? null : { income: Number(treasuryRow?.income ?? 0), expenses: Number(treasuryRow?.expenses ?? 0), fees: Number(treasuryRow?.fees ?? 0), balance: Number(treasuryRow?.balance ?? 0) };
  const paid = dueCountsError ? null : Number(dueCounts?.[0]?.paid_households ?? 0);
  const myDuePaid = Boolean(myDue);
  const junta = (Array.isArray(profile?.juntas) ? profile.juntas[0] : profile?.juntas) ?? null;
  const month = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date());
  const urgent = announcements?.find((item) => item.category === 'urgente');

  return <InicioV2
    profile={profile!}
    junta={junta}
    month={month.charAt(0).toUpperCase() + month.slice(1)}
    announcements={announcements ?? []}
    urgent={urgent?.content}
    activePoll={activePoll}
    myDuePaid={myDuePaid}
    period={period}
    treasury={treasury}
    treasuryError={Boolean(treasuryError)}
    paidHouseholds={dueCountsError ? null : paid}
    totalHouseholds={Number(dueCounts?.[0]?.total_households ?? 0)}
    sociosCount={sociosCount ?? 0}
    boardContacts={(boardContacts ?? []) as never[]}
    pendingApplications={pendingApplications ?? 0}
    pendingProposals={pendingProposals ?? 0}
  />;
}
