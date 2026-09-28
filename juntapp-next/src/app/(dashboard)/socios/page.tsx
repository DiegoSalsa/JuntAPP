import { currentChileBillingPeriod } from '@/lib/billing-period';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import SociosClient from '@/components/dashboard/socios/SociosClient';

export const metadata: Metadata = {
  title: 'Padrón de Socios — JuntAPP',
};

export default async function SociosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, juntas(*)')
    .eq('id', user!.id)
    .single();

  const { data: socios } = await supabase
    .from('profiles')
    .select('*')
    .eq('junta_id', profile?.junta_id)
    .order('name', { ascending: true });

  const { data: boardContacts } = profile?.role === 'vecino' ? await supabase.rpc('board_contacts', { p_junta_id: profile.junta_id }) : { data: [] };
  const roster = profile?.role === 'dirigente' ? (socios ?? []) : [...(socios ?? []), ...(boardContacts ?? [])];

  const period = `${currentChileBillingPeriod()}-01`;
  const { data: mercadoPagoDues } = await supabase
    .from('member_dues')
    .select('household_id')
    .eq('junta_id', profile?.junta_id)
    .eq('period', period)
    .eq('status', 'paid')
    .not('mercadopago_payment_id', 'is', null);
  const { data: paidDues } = await supabase
    .from('member_dues')
    .select('household_id')
    .eq('junta_id', profile?.junta_id)
    .eq('period', period)
    .eq('status', 'paid')
    .not('household_id', 'is', null);
  const paidHouseholdIds = new Set((paidDues ?? []).map((due) => due.household_id));
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
      paidByMercadoPagoHouseholdIds={(mercadoPagoDues ?? []).flatMap((due) => due.household_id ? [due.household_id] : [])}
      applications={applications ?? []}
    />
  );
}
