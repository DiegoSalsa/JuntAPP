import { currentChileBillingPeriod } from '@/lib/billing-period';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import type { Profile } from '@/lib/types';
import SociosClient from '@/components/dashboard/socios/SociosClient';

export const metadata: Metadata = {
  title: 'Padrón de Socios — JuntAPP',
};

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
  const search = String(params.q ?? '').trim().slice(0, 80);
  const role = params.role === 'dirigente' || params.role === 'vecino' ? params.role : '';
  const position = String(params.position ?? '').trim().slice(0, 40);
  const due = params.due === 'al_dia' || params.due === 'pendiente' ? params.due : '';
  const isDirigente = profile?.role === 'dirigente';
  let rosterQuery = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .eq('junta_id', profile?.junta_id)
    .order('name', { ascending: true })
    .range(from, from + pageSize - 1);
  if (search) rosterQuery = rosterQuery.or(`name.ilike.%${search}%,rut.ilike.%${search}%,address.ilike.%${search}%`);
  if (role) rosterQuery = rosterQuery.eq('role', role);
  if (position) rosterQuery = rosterQuery.eq('board_position', position);

  const { data: boardContacts } = profile?.role === 'vecino' ? await supabase.rpc('board_contacts', { p_junta_id: profile.junta_id }) : { data: [] };

  const period = `${currentChileBillingPeriod()}-01`;
  const { data: paidDues } = await supabase
    .from('member_dues')
    .select('household_id')
    .eq('junta_id', profile?.junta_id)
    .eq('period', period)
    .eq('status', 'paid')
    .not('household_id', 'is', null);
  const paidHouseholdIds = new Set((paidDues ?? []).map((due) => due.household_id));
  if (isDirigente && due) {
    rosterQuery = due === 'al_dia'
      ? rosterQuery.in('household_id', [...paidHouseholdIds])
      : paidHouseholdIds.size ? rosterQuery.not('household_id', 'in', `(${[...paidHouseholdIds].join(',')})`) : rosterQuery;
  }
  const { data: socios, count: totalSocios } = isDirigente ? await rosterQuery : { data: [], count: 0 };
  const roster: Profile[] = (isDirigente ? (socios ?? []) : (boardContacts ?? [])) as Profile[];
  const { data: dueHistory } = await supabase
    .from('member_dues')
    .select('household_id, period, status, amount, payment_source, mercadopago_payment_id, payment_batch_id')
    .eq('junta_id', profile?.junta_id)
    .order('period', { ascending: false });
  const { data: households } = await supabase
    .from('households')
    .select('id, created_at')
    .eq('junta_id', profile?.junta_id);
  const householdCreatedAtById = Object.fromEntries((households ?? []).map((household) => [household.id, household.created_at]));
  const sociosWithCurrentStatus = roster.map((socio) => ({
    ...socio,
    cuota_status: paidHouseholdIds.has(socio.household_id) ? 'al_dia' as const : 'pendiente' as const,
  }));
  const currentProfile = profile ? {
    ...profile,
    cuota_status: paidHouseholdIds.has(profile.household_id) ? 'al_dia' as const : 'pendiente' as const,
  } : null;

  const { data: applications } = profile?.role === 'dirigente' ? await supabase
    .from('membership_applications')
    .select('*')
    .eq('junta_id', profile.junta_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true }) : { data: [] };

  return (
    <SociosClient
      socios={sociosWithCurrentStatus}
      currentProfile={currentProfile!}
      junta={(Array.isArray(profile?.juntas) ? profile.juntas[0] : profile?.juntas)!}
      applications={applications ?? []}
      householdCreatedAtById={householdCreatedAtById}
      dueHistory={(dueHistory ?? []).map((due) => ({ household_id: due.household_id, period: due.period, status: due.status, amount: Number(due.amount), payment_source: due.payment_source, mercadopago_payment_id: due.mercadopago_payment_id, payment_batch_id: due.payment_batch_id }))}
      totalSocios={totalSocios ?? 0}
      page={page}
      pageSize={pageSize}
      initialSearch={search}
      initialFilters={{ role, position, due }}
    />
  );
}
