import { currentChileBillingPeriod } from '@/lib/billing-period';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import TesoreriaClient from '@/components/dashboard/tesoreria/TesoreriaClient';
import { createAdminClient } from '@/lib/supabase/admin';
import { mercadoPagoConnectConfigured } from '@/lib/mercadopago-connect';

export const metadata: Metadata = {
  title: 'Tesorería — JuntAPP',
};

export default async function TesoreriaPage({ searchParams }: { searchParams: Promise<{ cuota?: string; mercadopago?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, juntas(*)')
    .eq('id', user!.id)
    .single();

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, junta_id, type, description, amount, date, created_by, created_at, source, accounting_kind, account_code, destination_account_code, category, gross_amount, fee_amount, net_amount, verification_status, verified_at, is_immutable')
    .eq('junta_id', profile?.junta_id)
    .order('date', { ascending: false });

  const junta = Array.isArray(profile?.juntas) ? profile.juntas[0] : profile?.juntas;
  const period = `${currentChileBillingPeriod()}-01`;
  const { data: currentDue } = await supabase
    .from('member_dues')
    .select('*')
    .eq('household_id', profile?.household_id)
    .eq('period', period)
    .maybeSingle();
  const { data: mercadoPagoAccount } = profile ? await createAdminClient()
    .from('mercadopago_junta_accounts')
    .select('mercadopago_user_id, connected_at')
    .eq('junta_id', profile.junta_id)
    .maybeSingle() : { data: null };
  const admin = createAdminClient();
  const [{ data: lastTreasurySync }, { data: pendingTreasurySync }] = profile ? await Promise.all([
    admin.from('treasury_sync_runs').select('completed_at, imported_count').eq('junta_id', profile.junta_id).eq('status', 'completed').order('completed_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('treasury_sync_runs').select('id').eq('junta_id', profile.junta_id).in('status', ['pending', 'processing']).limit(1).maybeSingle(),
  ]) : [{ data: null }, { data: null }];
  const params = await searchParams;

  const { data: households } = await supabase
    .from('households')
    .select('id')
    .eq('junta_id', profile?.junta_id);
  const { data: paidHouseholdDues } = await supabase
    .from('member_dues')
    .select('household_id')
    .eq('junta_id', profile?.junta_id)
    .eq('period', period)
    .eq('status', 'paid')
    .not('household_id', 'is', null);

  const { data: files } = await supabase.storage
    .from('transparency_reports')
    .list(profile?.junta_id, { sortBy: { column: 'created_at', order: 'desc' } });

  const documents = await Promise.all((files ?? []).map(async (file) => {
    const path = `${profile!.junta_id}/${file.name}`;
    const { data } = await supabase.storage.from('transparency_reports').createSignedUrl(path, 3600);
    return {
      name: file.name.replace(/^[0-9a-f-]{36}-/, ''),
      path,
      size: Number(file.metadata?.size ?? 0),
      created_at: file.created_at ?? null,
      signedUrl: data?.signedUrl ?? null,
    };
  }));

  return (
    <TesoreriaClient
      transactions={transactions || []}
      documents={documents}
      currentProfile={profile!}
      junta={junta!}
      currentDue={currentDue ?? null}
      paymentReturn={params.cuota ?? null}
      connectionReturn={params.mercadopago ?? null}
      mercadoPagoConnection={{
        connected: Boolean(mercadoPagoAccount),
        mercadoPagoUserId: mercadoPagoAccount?.mercadopago_user_id ?? null,
        connectedAt: mercadoPagoAccount?.connected_at ?? null,
        oauthConfigured: mercadoPagoConnectConfigured(),
      }}
      treasurySyncStatus={{
        lastCompletedAt: lastTreasurySync?.completed_at ?? null,
        lastImportedCount: Number(lastTreasurySync?.imported_count ?? 0),
        pending: Boolean(pendingTreasurySync),
      }}
      totalHouseholds={households?.length ?? 0}
      paidHouseholds={new Set((paidHouseholdDues ?? []).map((due) => due.household_id)).size}
    />
  );
}
