import { currentChileBillingPeriod } from '@/lib/billing-period';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import TesoreriaClient from '@/components/dashboard/tesoreria/TesoreriaClient';
import { createAdminClient } from '@/lib/supabase/admin';
import { mercadoPagoConnectConfigured } from '@/lib/mercadopago-connect';
import type { TreasuryStats } from '@/lib/treasury';

export const metadata: Metadata = {
  title: 'Tesorería — JuntAPP',
};

export default async function TesoreriaPage({ searchParams }: { searchParams: Promise<{ cuota?: string; mercadopago?: string; movPage?: string; movType?: string; movSource?: string; movFrom?: string; movTo?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, juntas(*)')
    .eq('id', user!.id)
    .single();

  const params = await searchParams;
  const transactionPage = Math.max(1, Number(params.movPage ?? '1') || 1);
  const transactionPageSize = 50;
  const transactionFrom = (transactionPage - 1) * transactionPageSize;
  const transactionType = params.movType === 'ingreso' || params.movType === 'egreso' ? params.movType : null;
  const transactionSource = ['manual', 'mercadopago', 'bank_import'].includes(params.movSource ?? '') ? params.movSource! : null;
  let transactionQuery = supabase
    .from('transactions')
    .select('id, junta_id, type, description, amount, date, created_by, created_at, source, accounting_kind, account_code, destination_account_code, category, gross_amount, fee_amount, net_amount, verification_status, verified_at, is_immutable', { count: 'exact' })
    .eq('junta_id', profile?.junta_id)
    .order('date', { ascending: false }).order('id', { ascending: false })
    .range(transactionFrom, transactionFrom + transactionPageSize - 1);
  if (transactionType) transactionQuery = transactionQuery.eq('type', transactionType);
  if (transactionSource) transactionQuery = transactionQuery.eq('source', transactionSource);
  if (params.movFrom) transactionQuery = transactionQuery.gte('date', params.movFrom);
  if (params.movTo) transactionQuery = transactionQuery.lte('date', params.movTo);
  const [{ data: transactions, count: transactionTotal }, { data: summaryRows, error: summaryError }] = await Promise.all([
    transactionQuery,
    supabase.rpc('treasury_summary', { p_junta_id: profile?.junta_id, p_from_date: params.movFrom ?? null, p_to_date: params.movTo ?? null, p_type: transactionType, p_source: transactionSource }),
  ]);
  if (summaryError) console.error('[tesoreria] No fue posible obtener el resumen de caja', summaryError);
  const summary = summaryRows?.[0];
  const transactionSummary: TreasuryStats = { income: Number(summary?.income ?? 0), expenses: Number(summary?.expenses ?? 0), fees: Number(summary?.fees ?? 0), balance: Number(summary?.balance ?? 0) };

  const junta = Array.isArray(profile?.juntas) ? profile.juntas[0] : profile?.juntas;
  const period = `${currentChileBillingPeriod()}-01`;
  const { data: currentDue } = await supabase
    .from('member_dues')
    .select('*')
    .eq('household_id', profile?.household_id)
    .eq('period', period)
    .maybeSingle();
  const { data: dueHistory } = await supabase
    .from('member_dues')
    .select('*')
    .eq('household_id', profile?.household_id)
    .order('period', { ascending: true });
  const { data: household } = await supabase
    .from('households')
    .select('created_at')
    .eq('id', profile?.household_id)
    .maybeSingle();
  const { data: paymentBatches } = profile ? await createAdminClient()
    .from('due_payment_batches')
    .select('id, total_amount, status, payment_source, mercadopago_payment_id, created_at, confirmed_at, due_payment_batch_items(period, amount)')
    .eq('junta_id', profile.junta_id)
    .eq('household_id', profile.household_id)
    .order('created_at', { ascending: false }) : { data: [] };
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
  const { data: dueCounts } = await supabase.rpc('junta_due_household_counts', { p_junta_id: profile?.junta_id, p_period: period });
  const householdCount = Number(dueCounts?.[0]?.total_households ?? 0);
  const paidHouseholdCount = Number(dueCounts?.[0]?.paid_households ?? 0);

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
      transactionSummary={transactionSummary}
      transactionPage={transactionPage}
      transactionPageSize={transactionPageSize}
      transactionTotal={transactionTotal ?? 0}
      transactionFilters={{ type: transactionType ?? '', source: transactionSource ?? '', from: params.movFrom ?? '', to: params.movTo ?? '' }}
      documents={documents}
      currentProfile={profile!}
      junta={junta!}
      currentDue={currentDue ?? null}
      dueHistory={dueHistory ?? []}
      householdCreatedAt={household?.created_at ?? null}
      paymentBatches={paymentBatches ?? []}
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
      totalHouseholds={householdCount ?? 0}
      paidHouseholds={paidHouseholdCount ?? 0}
      now={new Date().toISOString()}
    />
  );
}
