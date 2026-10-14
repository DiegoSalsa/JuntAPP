import { currentChileBillingPeriodStart } from '@/lib/billing-period';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import type { Profile } from '@/lib/types';
import SociosClient from '@/components/dashboard/socios/SociosClient';

export const metadata: Metadata = {
  title: 'Padrón de Socios — JuntAPP',
};

type RosterRow = Profile & { household_created_at?: string; total_count?: number };
type DueHistoryRow = { household_id: string; period: string; status: string; amount: number | string | null; payment_source: string | null; payment_batch_id: string | null; total_count?: number | string | null };

export default async function SociosPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; role?: string; position?: string; due?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, juntas(*)')
    .eq('id', user!.id)
    .single();

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? '1') || 1);
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const search = String(params.q ?? '').replace(/[%,_(),]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const role = params.role === 'dirigente' || params.role === 'vecino' ? params.role : '';
  const position = String(params.position ?? '').trim().slice(0, 40);
  const due = params.due === 'al_dia' || params.due === 'pendiente' ? params.due : '';
  const isDirigente = profile?.role === 'dirigente';
  const period = currentChileBillingPeriodStart();

  const [{ data: boardContacts }, { data: currentDue }, { data: currentHousehold }] = await Promise.all([
    profile?.role === 'vecino' ? supabase.rpc('board_contacts', { p_junta_id: profile.junta_id }) : Promise.resolve({ data: [] }),
    profile?.household_id ? supabase.from('member_dues').select('status').eq('junta_id', profile.junta_id).eq('household_id', profile.household_id).eq('period', period).maybeSingle() : Promise.resolve({ data: null }),
    profile?.household_id ? supabase.from('households').select('id, created_at').eq('id', profile.household_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  // Filtering, exact counts and pagination happen in one tenant-scoped RPC.
  // This avoids loading every due or household row into the request.
  const { data: rosterRows } = isDirigente ? await supabase.rpc('junta_roster_page', {
    p_period: period,
    p_search: search || null,
    p_role: role || null,
    p_position: position || null,
    p_due: due || null,
    p_offset: from,
    p_limit: pageSize,
  }) : { data: [] };
  const rosterPage = (rosterRows ?? []) as RosterRow[];
  const roster: Profile[] = isDirigente
    ? rosterPage
    : ((boardContacts ?? []) as Array<Partial<Profile>>).map((contact) => ({
      ...contact,
      role: 'dirigente' as const,
      junta_id: profile?.junta_id ?? '',
      household_id: '',
      cuota_status: 'pendiente' as const,
      created_at: '',
    } as Profile));
  const totalSocios = isDirigente ? Number(rosterPage[0]?.total_count ?? 0) : 0;

  // History is limited to households visible on this page plus the current
  // user's household, which covers payment actions without a global query.
  const pageHouseholdIds = [...new Set(roster.map((socio) => socio.household_id).filter(Boolean))];
  if (profile?.household_id && !pageHouseholdIds.includes(profile.household_id)) pageHouseholdIds.push(profile.household_id);
  const dueHistory: DueHistoryRow[] = [];
  if (pageHouseholdIds.length) {
    const historyPageSize = 200;
    let offset = 0;
    while (true) {
      const { data, error } = await supabase.rpc('junta_due_history', {
        p_household_ids: pageHouseholdIds,
        p_offset: offset,
        p_limit: historyPageSize,
      });
      if (error) break;
      const rows = (data ?? []) as DueHistoryRow[];
      dueHistory.push(...rows);
      const total = Number(rows[0]?.total_count ?? dueHistory.length);
      if (!rows.length || dueHistory.length >= total || rows.length < historyPageSize) break;
      offset += historyPageSize;
    }
  }
  const householdCreatedAtById = Object.fromEntries([
    ...rosterPage.filter((socio) => socio.household_id && socio.household_created_at).map((socio) => [socio.household_id, socio.household_created_at!] as const),
    ...(currentHousehold ? [[currentHousehold.id, currentHousehold.created_at] as const] : []),
  ]);
  const { data: hasSecretary } = isDirigente ? await supabase.rpc('junta_has_secretary') : { data: false };

  const currentProfile = profile ? {
    ...profile,
    cuota_status: currentDue?.status === 'paid' ? 'al_dia' as const : 'pendiente' as const,
  } : null;

  const { data: applications } = profile?.role === 'dirigente' ? await supabase
    .from('membership_applications')
    .select('*')
    .eq('junta_id', profile.junta_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true }) : { data: [] };

  const { data: dueRates, error: dueRatesError } = await supabase.from('monthly_due_rates')
    .select('effective_from, amount').eq('junta_id', profile?.junta_id).order('effective_from');
  if (dueRatesError) throw new Error('No fue posible cargar los montos de las cuotas por período.');

  return (
    <SociosClient
      socios={roster}
      dueRates={dueRates ?? []}
      currentProfile={currentProfile!}
      junta={(Array.isArray(profile?.juntas) ? profile.juntas[0] : profile?.juntas)!}
      applications={applications ?? []}
      householdCreatedAtById={householdCreatedAtById}
      dueHistory={dueHistory.map((due) => ({ household_id: due.household_id, period: due.period, status: due.status, amount: Number(due.amount ?? 0), payment_source: due.payment_source, payment_batch_id: due.payment_batch_id }))}
      totalSocios={totalSocios}
      page={page}
      pageSize={pageSize}
      initialSearch={search}
      initialFilters={{ role, position, due }}
      hasSecretary={Boolean(hasSecretary)}
    />
  );
}
