import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { getJuntaMercadoPagoAccount } from '@/lib/mercadopago-connect';
import { parseSettlementReport, settlementRowToMovement, type SettlementRow } from '@/lib/mercadopago-treasury-report';

type SettlementReportTask = {
  id?: number | string;
  status?: string;
  file_name?: string | null;
  message?: string;
};

const REPORT_API = 'https://api.mercadopago.com/v1/account/settlement_report';

async function mercadoPagoRequest(accessToken: string, url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });
  return response;
}

async function importSettlementRows(juntaId: string, rows: SettlementRow[]) {
  const admin = createAdminClient();
  let imported = 0;

  for (const row of rows) {
    const movement = settlementRowToMovement(row);
    if (!movement.sourceId || !movement.transactionType || !movement.net) continue;
    const isRefund = movement.transactionType.includes('REFUND') || movement.transactionType.includes('CHARGEBACK');
    const providerOperationType = isRefund
      ? 'refund'
      : movement.accountingKind === 'income'
        ? 'payment'
        : `event:${movement.eventKey}`;

    const transactionValues = {
      junta_id: juntaId,
      type: movement.type,
      description: movement.description,
      amount: movement.gross,
      date: new Date(movement.transactionDate).toISOString().slice(0, 10),
      created_by: null,
      source: 'mercadopago',
      accounting_kind: movement.accountingKind,
      account_code: 'mercadopago',
      destination_account_code: movement.accountingKind === 'transfer' ? 'bank' : null,
      category: movement.category,
      gross_amount: movement.gross,
      fee_amount: movement.fee,
      net_amount: movement.net,
      provider: 'mercadopago',
      provider_transaction_id: movement.sourceId,
      provider_operation_type: providerOperationType,
      provider_event_key: movement.eventKey,
      external_reference: movement.externalReference || null,
      verification_status: 'reconciled',
      verified_at: new Date().toISOString(),
      is_immutable: true,
    };

    const { data: existing } = await admin
      .from('transactions')
      .select('id')
      .eq('junta_id', juntaId)
      .eq('provider_event_key', movement.eventKey)
      .maybeSingle();
    if (existing) continue;

    const { error: eventError } = await admin.from('payment_events').insert({
      provider_event_id: `mercadopago-settlement:${movement.eventKey}`,
      junta_id: juntaId,
      payload: row,
    });
    if (eventError?.code !== '23505' && eventError) throw new Error(eventError.message);

    const { data: due } = await admin
      .from('member_dues')
      .select('transaction_id, refund_transaction_id')
      .eq('junta_id', juntaId)
      .eq('mercadopago_payment_id', movement.sourceId)
      .maybeSingle();
    const { data: batch } = await admin
      .from('due_payment_batches')
      .select('transaction_id, refund_transaction_id')
      .eq('junta_id', juntaId)
      .eq('mercadopago_payment_id', movement.sourceId)
      .maybeSingle();
    const { data: existingOperation } = await admin
      .from('transactions')
      .select('id')
      .eq('junta_id', juntaId)
      .eq('provider', 'mercadopago')
      .eq('provider_transaction_id', movement.sourceId)
      .eq('provider_operation_type', providerOperationType)
      .eq('accounting_kind', movement.accountingKind)
      .maybeSingle();
    const linkedTransactionId = isRefund
      ? due?.refund_transaction_id ?? batch?.refund_transaction_id ?? existingOperation?.id
      : due?.transaction_id ?? batch?.transaction_id ?? existingOperation?.id;

    if (linkedTransactionId) {
      const { error } = await admin.from('transactions').update(transactionValues).eq('id', linkedTransactionId);
      if (error) throw new Error(error.message);
      imported += 1;
      continue;
    }

    const { error } = await admin.from('transactions').insert(transactionValues);
    if (error?.code === '23505') continue;
    if (error) throw new Error(error.message);
    imported += 1;
  }
  return imported;
}

async function harvestPendingReports(juntaId: string, accessToken: string) {
  const admin = createAdminClient();
  const { data: pendingRuns, error } = await admin
    .from('treasury_sync_runs')
    .select('*')
    .eq('junta_id', juntaId)
    .eq('provider', 'mercadopago')
    .in('status', ['pending', 'processing'])
    .order('requested_at');
  if (error) throw new Error(error.message);

  let imported = 0;
  let pending = 0;
  for (const run of pendingRuns ?? []) {
    if (!run.provider_task_id) continue;
    const taskResponse = await mercadoPagoRequest(accessToken, `${REPORT_API}/task/${encodeURIComponent(run.provider_task_id)}`);
    const task = await taskResponse.json().catch(() => ({})) as SettlementReportTask;
    if (!taskResponse.ok) {
      await admin.from('treasury_sync_runs').update({ status: 'failed', error_message: task.message ?? `HTTP ${taskResponse.status}` }).eq('id', run.id);
      continue;
    }

    const status = task.status?.toLowerCase() ?? 'pending';
    if (!task.file_name) {
      if (['failed', 'error', 'deleted'].includes(status)) {
        await admin.from('treasury_sync_runs').update({ status: 'failed', error_message: task.message ?? `Reporte ${status}` }).eq('id', run.id);
      } else {
        pending += 1;
        await admin.from('treasury_sync_runs').update({ status: 'processing' }).eq('id', run.id);
      }
      continue;
    }

    const fileResponse = await mercadoPagoRequest(accessToken, `${REPORT_API}/${encodeURIComponent(task.file_name)}`);
    if (!fileResponse.ok) {
      const detail = await fileResponse.text();
      await admin.from('treasury_sync_runs').update({ status: 'failed', error_message: detail || `HTTP ${fileResponse.status}` }).eq('id', run.id);
      continue;
    }
    const rows = parseSettlementReport(await fileResponse.text());
    const runImported = await importSettlementRows(juntaId, rows);
    imported += runImported;
    await admin.from('treasury_sync_runs').update({
      status: 'completed',
      imported_count: runImported,
      file_name: task.file_name,
      error_message: null,
      completed_at: new Date().toISOString(),
    }).eq('id', run.id);
  }
  return { imported, pending };
}

async function requestSettlementReport(juntaId: string, accessToken: string) {
  const admin = createAdminClient();
  const { data: active } = await admin
    .from('treasury_sync_runs')
    .select('id')
    .eq('junta_id', juntaId)
    .eq('provider', 'mercadopago')
    .in('status', ['pending', 'processing'])
    .limit(1)
    .maybeSingle();
  if (active) return false;

  const { data: latest } = await admin
    .from('treasury_sync_runs')
    .select('period_end')
    .eq('junta_id', juntaId)
    .eq('provider', 'mercadopago')
    .eq('status', 'completed')
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle();
  const end = new Date();
  const fallbackStart = new Date(end.getTime() - 31 * 24 * 60 * 60 * 1000);
  const previousEnd = latest?.period_end ? new Date(latest.period_end) : fallbackStart;
  const start = new Date(Math.max(fallbackStart.getTime(), previousEnd.getTime() - 2 * 24 * 60 * 60 * 1000));
  const response = await mercadoPagoRequest(accessToken, REPORT_API, {
    method: 'POST',
    body: JSON.stringify({ begin_date: start.toISOString(), end_date: end.toISOString() }),
  });
  const task = await response.json().catch(() => ({})) as SettlementReportTask;
  if (response.status !== 202 || !task.id) throw new Error(task.message ?? `Mercado Pago no pudo preparar el reporte (HTTP ${response.status}).`);
  const { error } = await admin.from('treasury_sync_runs').insert({
    junta_id: juntaId,
    provider: 'mercadopago',
    provider_task_id: String(task.id),
    period_start: start.toISOString(),
    period_end: end.toISOString(),
    status: 'pending',
  });
  if (error) throw new Error(error.message);
  return true;
}

export async function syncMercadoPagoTreasury(juntaId: string, { requestNewReport = true } = {}) {
  const account = await getJuntaMercadoPagoAccount(juntaId);
  if (!account) throw new Error('La junta no tiene una cuenta de Mercado Pago conectada.');
  const harvested = await harvestPendingReports(juntaId, account.access_token);
  const requested = requestNewReport ? await requestSettlementReport(juntaId, account.access_token) : false;
  return { ...harvested, requested };
}
