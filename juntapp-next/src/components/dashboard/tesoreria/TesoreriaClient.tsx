'use client';

import { currentChileBillingPeriod } from '@/lib/billing-period';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Junta, MemberDue, MercadoPagoConnectionSummary, Profile, Transaction, TreasuryDocument, TreasurySyncStatus } from '@/lib/types';
import CashflowChart from './CashflowChart';
import ExpenseChart from './ExpenseChart';

export default function TesoreriaClient({ transactions, documents, currentProfile, junta, currentDue, paymentReturn, connectionReturn, mercadoPagoConnection, treasurySyncStatus, totalHouseholds, paidHouseholds }: { transactions: Transaction[]; documents: TreasuryDocument[]; currentProfile: Profile; junta: Junta; currentDue: MemberDue | null; paymentReturn: string | null; connectionReturn: string | null; mercadoPagoConnection: MercadoPagoConnectionSummary; treasurySyncStatus: TreasurySyncStatus; totalHouseholds: number; paidHouseholds: number }) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentError, setDocumentError] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [mercadoPagoMessage, setMercadoPagoMessage] = useState('');
  const [dueAmount, setDueAmount] = useState(junta.monthly_due_amount);
  const [reportOpen, setReportOpen] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const router = useRouter();
  const isDirigente = currentProfile.role === 'dirigente';
  const canConnectMercadoPago = isDirigente && (junta.owner_id === currentProfile.id || currentProfile.board_position === 'presidente');
  const canEditDueAmount = isDirigente && ['presidente', 'tesorero'].includes(currentProfile.board_position ?? '');
  const currentDuePaid = currentDue?.status === 'paid';
  const stats = useMemo(() => calculateTreasuryStats(transactions), [transactions]);
  const currentMonthTransactions = useMemo(() => {
    const month = currentChileBillingPeriod();
    return transactions.filter((transaction) => transaction.date.startsWith(month));
  }, [transactions]);
  const monthlyStats = useMemo(() => calculateTreasuryStats(currentMonthTransactions), [currentMonthTransactions]);

  async function handleAddTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); const form = new FormData(event.currentTarget);
    const { error } = await createClient().from('transactions').insert({ type: form.get('type'), description: form.get('description'), amount: Number(form.get('amount')), date: form.get('date'), junta_id: currentProfile.junta_id, created_by: currentProfile.id });
    if (!error) { setShowModal(false); router.refresh(); } setLoading(false);
  }

  async function uploadDocument(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return; setDocumentError('');
    if (file.size > 10 * 1024 * 1024) { setDocumentError('El archivo no puede superar 10 MB.'); return; }
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) { setDocumentError('Solo se permiten archivos PDF, JPG o PNG.'); return; }
    setDocumentLoading(true); const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_'); const path = `${currentProfile.junta_id}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await createClient().storage.from('transparency_reports').upload(path, file);
    if (error) setDocumentError(error.message); else router.refresh(); setDocumentLoading(false); event.target.value = '';
  }

  async function deleteDocument(path: string) { if (!confirm('¿Deseas eliminar este documento?')) return; const { error } = await createClient().storage.from('transparency_reports').remove([path]); if (error) setDocumentError(error.message); else router.refresh(); }

  async function startDuePayment() { setPaymentLoading(true); setPaymentError(''); const response = await fetch('/api/dues/checkout', { method: 'POST' }); const result = await response.json(); if (!response.ok) { setPaymentError(result.error ?? 'No fue posible iniciar el pago.'); setPaymentLoading(false); return; } window.location.assign(result.checkoutUrl); }
  async function saveDueAmount(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setMercadoPagoMessage('Guardando…'); const response = await fetch('/api/dues/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: dueAmount }) }); const result = await response.json(); setMercadoPagoMessage(response.ok ? 'Monto mensual actualizado.' : (result.error ?? 'No fue posible actualizar el monto.')); if (response.ok) router.refresh(); }
  async function disconnectMercadoPago() { if (!confirm('¿Desconectar la cuenta de Mercado Pago? Los vecinos no podrán iniciar nuevos pagos hasta volver a conectarla.')) return; setMercadoPagoMessage('Desconectando…'); const response = await fetch('/api/mercadopago/connect/disconnect', { method: 'POST' }); const result = await response.json(); setMercadoPagoMessage(response.ok ? 'Cuenta desconectada.' : (result.error ?? 'No fue posible desconectar la cuenta.')); if (response.ok) router.refresh(); }
  async function sendReminders() { setReminderMessage('Enviando…'); const response = await fetch('/api/notifications/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'cuota', title: 'Recordatorio de Cuota Social', message: 'Tu cuota social se encuentra pendiente. Ingresa a JuntAPP para pagar de forma segura con Mercado Pago.', action: '/tesoreria', onlyPending: true }) }); const result = await response.json(); setReminderMessage(response.ok ? `Avisos enviados a ${result.delivered} socios pendientes.` : (result.error ?? 'No fue posible enviar los avisos.')); }
  async function syncMercadoPago() {
    setSyncLoading(true);
    setSyncMessage('Consultando movimientos verificados…');
    const response = await fetch('/api/treasury/mercadopago/sync', { method: 'POST' });
    const result = await response.json();
    if (!response.ok) setSyncMessage(result.error ?? 'No fue posible sincronizar Mercado Pago.');
    else if (result.imported > 0) setSyncMessage(`Sincronización completa: ${result.imported} movimientos conciliados.`);
    else if (result.requested || result.pending > 0) setSyncMessage('Mercado Pago está preparando el reporte. La conciliación continuará automáticamente.');
    else setSyncMessage('La cuenta ya se encuentra al día.');
    if (response.ok) router.refresh();
    setSyncLoading(false);
  }

  return <section className="app-view active" id="view-tesoreria">
    <header className="view-header"><div><span className="view-subtitle">Transparencia y Cuentas Claras</span><h2 className="view-title">Tesorería Transparente</h2></div><div className="view-actions"><button className="tour-help-btn"><span>?</span><span>Guía</span></button><button className="btn btn-ghost" onClick={() => setReportOpen(true)}>Generar Reporte Mensual</button>{isDirigente && <button className="btn btn-primary" onClick={() => setShowModal(true)}>＋ Registrar Movimiento</button>}</div></header>

    {isDirigente && <div className="board-position-panel shadow-box mb-24">
      <div>
        <span className="view-subtitle">Recaudación y conciliación automática</span>
        <h3 className="card-title">Mercado Pago: {mercadoPagoConnection.connected ? 'Conectado' : 'Sin conectar'}</h3>
        <p>{mercadoPagoConnection.connected ? `JuntAPP verifica cobros, comisiones, devoluciones y transferencias de ${junta.name}.` : 'Conecta la cuenta de la junta para cobrar y conciliar sus movimientos automáticamente.'}</p>
        {mercadoPagoConnection.connected && <div className="treasury-sync-status">
          <span className={`verification-badge ${!treasurySyncStatus.lastCompletedAt && treasurySyncStatus.pending ? 'pending' : 'verified'}`}>{!treasurySyncStatus.lastCompletedAt && treasurySyncStatus.pending ? 'Primer reporte en preparación' : 'Conciliación automática activa'}</span>
          <span>{treasurySyncStatus.lastCompletedAt ? `Última conciliación: ${formatDate(treasurySyncStatus.lastCompletedAt)}${treasurySyncStatus.lastImportedCount ? ` · ${treasurySyncStatus.lastImportedCount} movimientos nuevos` : ''}` : 'Aún no se ha completado la primera conciliación.'}</span>
        </div>}
        {connectionReturn === 'connected' && <span className="form-help">Cuenta conectada correctamente.</span>}
        {connectionReturn && connectionReturn !== 'connected' && <span className="form-error">Mercado Pago no completó la conexión. Intenta nuevamente.</span>}
        {syncMessage && <span className="form-help">{syncMessage}</span>}
      </div>
      <div className="board-position-control">
        {canConnectMercadoPago && !mercadoPagoConnection.connected && mercadoPagoConnection.oauthConfigured && <a className="btn btn-primary" href="/api/mercadopago/connect">Conectar Mercado Pago</a>}
        {canConnectMercadoPago && !mercadoPagoConnection.connected && !mercadoPagoConnection.oauthConfigured && <span className="form-help">Falta configurar Client ID y Client Secret de la aplicación Mercado Pago.</span>}
        {canEditDueAmount && mercadoPagoConnection.connected && <button type="button" className="btn btn-primary btn-block" disabled={syncLoading} onClick={() => void syncMercadoPago()}>{syncLoading ? 'Sincronizando…' : 'Sincronizar movimientos'}</button>}
        {canConnectMercadoPago && mercadoPagoConnection.connected && <button type="button" className="btn btn-secondary danger-action" onClick={() => void disconnectMercadoPago()}>Desconectar cuenta</button>}
        {canEditDueAmount && <form onSubmit={saveDueAmount}><label className="form-label" htmlFor="monthly-due-amount">Cuota mensual por domicilio</label><input id="monthly-due-amount" className="form-input" type="number" min="500" max="1000000" step="500" value={dueAmount} onChange={(event) => setDueAmount(Number(event.target.value))} required /><button className="btn btn-secondary btn-block" type="submit">Guardar monto</button></form>}
        {mercadoPagoMessage && <span className="form-help">{mercadoPagoMessage}</span>}
      </div>
    </div>}

    <div className="treasury-stats-grid"><div className="t-stat-card total-balance"><span className="t-stat-label">Caja Disponible Actual</span><h3 className="t-stat-value">{formatCurrency(stats.balance)}</h3><span className="t-stat-desc">Saldo neto; transferencias internas excluidas</span></div><div className="t-stat-card text-success-card"><span className="t-stat-label">Ingresos Brutos</span><h3 className="t-stat-value">+{formatCurrency(stats.income)}</h3><span className="t-stat-desc">Cuotas y aportes antes de comisiones</span></div><div className="t-stat-card text-danger-card"><span className="t-stat-label">Gastos y Comisiones</span><h3 className="t-stat-value">-{formatCurrency(stats.expenses)}</h3><span className="t-stat-desc">Incluye {formatCurrency(stats.fees)} cobrados por proveedores</span></div></div>

    <div className="charts-grid mt-24 mb-24"><div className="chart-card card shadow-box"><h3 className="card-title">Distribución de Egresos</h3><p className="card-subtitle">Clasificación de los gastos registrados</p><div className="chart-container"><ExpenseChart transactions={transactions} /></div></div><div className="chart-card card shadow-box"><h3 className="card-title">Flujo de Caja Mensual</h3><p className="card-subtitle">Comparativa histórica de ingresos y egresos</p><div className="chart-container"><CashflowChart transactions={transactions} /></div></div></div>

    <div className="split-grid"><div className="split-card main-split shadow-box"><div className="card-header"><div><h3 className="card-title">Libro de Caja Reciente</h3><p className="card-subtitle">Los movimientos verificados por Mercado Pago no pueden ser alterados.</p></div></div><div className="ledger-table-wrapper"><table className="ledger-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto / Descripción</th><th className="text-right">Monto (CLP)</th></tr></thead><tbody>{transactions.map((tx) => {
      const transfer = tx.accounting_kind === 'transfer';
      const verified = tx.source === 'mercadopago';
      const value = Math.abs(Number(tx.net_amount ?? tx.amount));
      return <tr key={tx.id}><td>{formatDate(tx.date)}</td><td><span className={`transaction-type ${transfer ? 'transferencia' : tx.type}`}>{transfer ? 'Transferencia' : tx.type === 'ingreso' ? 'Ingreso' : 'Egreso'}</span></td><td><div className="transaction-description"><span>{tx.description}</span><div className="transaction-metadata">{verified ? <span className={`verification-badge ${tx.verification_status === 'reconciled' ? 'verified' : 'pending'}`}>{tx.verification_status === 'reconciled' ? '✓ Conciliado con Mercado Pago' : '✓ Confirmado por Mercado Pago'}</span> : <span className="verification-badge manual">Registro manual</span>}{Number(tx.fee_amount ?? 0) > 0 && <span>Comisión: {formatCurrency(Number(tx.fee_amount))}</span>}</div></div></td><td className={`text-right ${transfer ? 'amount-transferencia' : `amount-${tx.type}`}`}>{transfer ? '↔ ' : tx.type === 'ingreso' ? '+' : '-'}{formatCurrency(value)}</td></tr>;
    })}</tbody></table>{!transactions.length && <p className="empty-state">No hay movimientos registrados.</p>}</div></div><div className="split-card side-split shadow-box"><h3 className="card-title">Recaudación por Domicilio</h3><p className="card-subtitle">Cada dirección paga una cuota mensual, aunque tenga varios socios asociados.</p><div className="cuota-progress-box"><div className="cuota-progress-bar-container"><div className="cuota-progress-bar-fill" style={{ width: `${totalHouseholds ? Math.round(paidHouseholds / totalHouseholds * 100) : 0}%` }} /></div><div className="cuota-progress-meta"><span className="cuota-progress-text">{paidHouseholds} de {totalHouseholds} domicilios al día ({totalHouseholds ? Math.round(paidHouseholds / totalHouseholds * 100) : 0}%)</span></div></div><div className={`payment-status-badge ${currentDuePaid ? 'paid' : 'outstanding'}`}><span>Cuota de {currentProfile.address}: <strong>{currentDuePaid ? 'Pagada' : 'Pendiente'}</strong></span></div><div className="payment-invoice-card"><span>Monto por domicilio definido por la junta</span><strong>{formatCurrency(junta.monthly_due_amount)}</strong></div>{paymentReturn === 'approved' && <p className="form-help">Mercado Pago recibió el pago. La confirmación final llegará automáticamente.</p>}{paymentReturn === 'pending' && <p className="form-help">El pago está pendiente de confirmación.</p>}{paymentReturn === 'failure' && <p className="form-error">El pago no se completó. Puedes volver a intentarlo.</p>}{!currentDuePaid && mercadoPagoConnection.connected && <button className="btn btn-primary btn-block btn-lg" disabled={paymentLoading} onClick={() => void startDuePayment()}>{paymentLoading ? 'Abriendo Mercado Pago…' : `Pagar cuota del domicilio · ${formatCurrency(junta.monthly_due_amount)}`}</button>}{!currentDuePaid && !mercadoPagoConnection.connected && <p className="form-help">La directiva debe conectar la cuenta Mercado Pago de la junta antes de recibir pagos.</p>}{paymentError && <p className="form-error">{paymentError}</p>}{isDirigente && <><button className="btn btn-secondary btn-block" onClick={sendReminders}>Enviar Recordatorios de Cuota</button>{reminderMessage && <p className="form-help">{reminderMessage}</p>}</>}</div></div>

    <div className="document-center mt-32 card shadow-box"><div className="card-header document-center-header"><div><h3 className="card-title">Repositorio de Transparencia</h3><p className="card-subtitle">Documentos oficiales, actas, rendiciones y cartolas digitalizadas</p></div>{isDirigente && <label className="btn btn-secondary btn-sm document-upload">{documentLoading ? 'Subiendo…' : 'Subir Documento'}<input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={documentLoading} onChange={uploadDocument} hidden /></label>}</div>{documentError && <p className="form-error">{documentError}</p>}<div className="document-grid">{documents.map((document) => <article className="document-card" key={document.path}><div className="document-icon">📄</div><div className="document-info"><h4>{document.name}</h4><span>{formatFileSize(document.size)}{document.created_at ? ` · ${formatDate(document.created_at)}` : ''}</span></div><div className="document-actions">{document.signedUrl && <a className="btn btn-sm btn-ghost" href={document.signedUrl} target="_blank" rel="noreferrer">Ver</a>}{isDirigente && <button className="btn btn-sm btn-secondary danger-action" onClick={() => deleteDocument(document.path)}>Eliminar</button>}</div></article>)}{!documents.length && <p className="empty-state">No hay documentos publicados.</p>}</div></div>

    {showModal && <div className="modal active" role="dialog" aria-modal="true"><div className="modal-dialog"><div className="modal-content"><div className="modal-header"><h3 className="modal-title">Registrar Movimiento</h3><button className="modal-close" onClick={() => setShowModal(false)}>×</button></div><div className="modal-body"><form onSubmit={handleAddTransaction}><div className="form-group"><label className="form-label">Tipo</label><select name="type" className="form-input" required><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select></div><div className="form-group"><label className="form-label">Descripción</label><input name="description" className="form-input" required /></div><div className="form-row"><div className="form-group"><label className="form-label">Monto</label><input name="amount" type="number" min="1" className="form-input" required /></div><div className="form-group"><label className="form-label">Fecha</label><input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="form-input" required /></div></div><div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Guardando…' : 'Registrar Movimiento'}</button></div></form></div></div></div></div>}
    {reportOpen && <div className="modal active report-modal" role="dialog" aria-modal="true"><div className="modal-dialog"><div className="modal-content"><div className="modal-header"><h3 className="modal-title">Reporte Mensual de Tesorería</h3><button className="modal-close" onClick={() => setReportOpen(false)}>×</button></div><div className="modal-body"><div className="report-summary-row income"><span>Ingresos brutos del mes</span><strong>{formatCurrency(monthlyStats.income)}</strong></div><div className="report-summary-row expense"><span>Gastos y comisiones del mes</span><strong>{formatCurrency(monthlyStats.expenses)}</strong></div><div className="report-summary-row"><span>Variación neta del mes</span><strong>{formatCurrency(monthlyStats.balance)}</strong></div><p className="card-subtitle">El reporte incluye {currentMonthTransactions.length} movimientos del mes actual y {documents.length} documentos disponibles.</p></div><div className="modal-footer"><button className="btn btn-ghost" onClick={() => setReportOpen(false)}>Cerrar</button><button className="btn btn-primary" onClick={() => window.print()}>Imprimir / Guardar PDF</button></div></div></div></div>}
  </section>;
}

function formatFileSize(bytes: number) { if (!bytes) return 'Tamaño desconocido'; if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }

function calculateTreasuryStats(transactions: Transaction[]) {
  return transactions.reduce((summary, transaction) => {
    const kind = transaction.accounting_kind ?? (transaction.type === 'ingreso' ? 'income' : 'expense');
    if (kind === 'transfer') return summary;
    const gross = Number(transaction.gross_amount ?? transaction.amount);
    const fee = Number(transaction.fee_amount ?? 0);
    const net = Number(transaction.net_amount ?? (transaction.type === 'ingreso' ? transaction.amount : -transaction.amount));
    if (kind === 'income') {
      summary.income += gross;
      summary.fees += fee;
      summary.expenses += fee;
    } else if (kind === 'expense') {
      summary.expenses += Math.abs(net);
    }
    summary.balance += net;
    return summary;
  }, { income: 0, expenses: 0, fees: 0, balance: 0 });
}
