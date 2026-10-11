'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatRUT, validateRUT } from '@/lib/utils';
import { ASSIGNABLE_BOARD_POSITIONS, boardPositionLabel } from '@/lib/board';
import { currentChileBillingPeriod } from '@/lib/billing-period';
import type { BoardPosition, Junta, MembershipApplication, Profile, UserRole } from '@/lib/types';

type AssignableBoardPosition = Exclude<BoardPosition, 'presidente'>;

type BoardModalMode = 'assign' | 'change' | 'remove';
type ManualAction = 'paid' | 'pending';
type DueHistoryItem = { household_id: string; period: string; status: string; amount: number; payment_source?: string | null; mercadopago_payment_id?: string | null; payment_batch_id?: string | null };

export default function SociosClient({ socios, currentProfile, junta, applications, householdCreatedAtById, dueHistory, totalSocios, page, pageSize, initialSearch, initialFilters }: { socios: Profile[]; currentProfile: Profile; junta: Junta; applications: MembershipApplication[]; householdCreatedAtById: Record<string, string>; dueHistory: DueHistoryItem[]; totalSocios: number; page: number; pageSize: number; initialSearch: string; initialFilters: { role: string; position: string; due: string } }) {
  const [search] = useState(initialSearch);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [contactSaved, setContactSaved] = useState('');
  const [subscriptionMessage, setSubscriptionMessage] = useState('');
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  const [inviteCodeMessage, setInviteCodeMessage] = useState('');
  const [paymentSocio, setPaymentSocio] = useState<Profile | null>(null);
  const [manualPaymentMethod, setManualPaymentMethod] = useState<'cash' | 'transfer' | 'other'>('cash');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentManagementError, setPaymentManagementError] = useState('');
  const [manualPeriods, setManualPeriods] = useState<string[]>([]);
  const [manualAction, setManualAction] = useState<ManualAction>('paid');
  const [deletingSocio, setDeletingSocio] = useState<Profile | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('vecino');
  const [invitePosition, setInvitePosition] = useState<AssignableBoardPosition>('dirigente');
  const [applicationLoading, setApplicationLoading] = useState<string | null>(null);
  const [applicationError, setApplicationError] = useState('');
  const [boardModal, setBoardModal] = useState<{ socio: Profile; mode: BoardModalMode } | null>(null);
  const [boardPositionChoice, setBoardPositionChoice] = useState<AssignableBoardPosition>('dirigente');
  const [boardRoleLoading, setBoardRoleLoading] = useState(false);
  const [boardRoleError, setBoardRoleError] = useState('');
  const router = useRouter();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();
  const isDirigente = currentProfile.role === 'dirigente';
  const isPresident = currentProfile.role === 'dirigente' && currentProfile.board_position === 'presidente';
  const isOwner = junta.owner_id === currentProfile.id;
  const hasSecretary = socios.some((socio) => socio.role === 'dirigente' && socio.board_position === 'secretario');
  const canReviewApplications = currentProfile.board_position === 'secretario'
    || (!hasSecretary && (currentProfile.board_position === 'presidente' || isOwner));
  const filtered = search === initialSearch ? socios : socios.filter((s) => [s.name, s.rut, s.address].some((value) => value.toLowerCase().includes(search.toLowerCase())));
  const totalPages = Math.max(1, Math.ceil(totalSocios / pageSize));

  function applyRosterFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams(currentSearchParams.toString());
    const form = new FormData(event.currentTarget);
    const values = { q: String(form.get('q') ?? '').trim(), role: String(form.get('role') ?? ''), position: String(form.get('position') ?? ''), due: String(form.get('due') ?? '') };
    Object.entries(values).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key));
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  function changeRosterPage(nextPage: number) {
    const params = new URLSearchParams(currentSearchParams.toString());
    params.set('page', String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  function openBoardModal(socio: Profile, mode: BoardModalMode) {
    const currentPosition = socio.board_position && socio.board_position !== 'presidente' ? socio.board_position : 'dirigente';
    setBoardPositionChoice(currentPosition);
    setBoardRoleError('');
    setBoardModal({ socio, mode });
  }

  async function handleAddSocio(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const rut = String(form.get('rut'));
    if (!validateRUT(rut)) { setFormError('Ingresa un RUT válido.'); setLoading(false); return; }
    const role = isPresident ? inviteRole : 'vecino';
    const response = await fetch('/api/members/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.get('name'), rut, address: form.get('address'), phone: form.get('phone'), email: form.get('email'), role, boardPosition: role === 'dirigente' ? invitePosition : undefined }) });
    const result = await response.json();
    if (response.ok) { setShowModal(false); router.refresh(); } else setFormError(result.error ?? 'No fue posible enviar la invitación.');
    setLoading(false);
  }

  async function updateContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const client = createClient();
    const nextEmail = String(form.get('email') ?? '').trim();
    const { error: phoneError } = await client.from('profiles').update({ phone: form.get('phone') }).eq('id', currentProfile.id);
    if (phoneError) { setContactSaved(phoneError.message); return; }
    const { error: emailError } = nextEmail !== currentProfile.email ? await client.auth.updateUser({ email: nextEmail }) : { error: null };
    setContactSaved(emailError ? emailError.message : nextEmail !== currentProfile.email ? 'Revisa tu nuevo correo para confirmar el cambio.' : 'Datos guardados correctamente.');
    if (!emailError) router.refresh();
  }

  async function submitBoardRole(boardPosition: AssignableBoardPosition | null) {
    if (!boardModal) return;
    setBoardRoleLoading(true);
    setBoardRoleError('');
    const response = await fetch(`/api/members/${boardModal.socio.id}/board-role`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ boardPosition }) });
    const result = await response.json();
    setBoardRoleLoading(false);
    if (!response.ok) { setBoardRoleError(result.error ?? 'No fue posible actualizar el cargo.'); return; }
    setBoardModal(null);
    router.refresh();
  }

  async function updateManualPayment(action: 'paid' | 'pending') {
    if (!paymentSocio) return;
    setPaymentSaving(true); setPaymentManagementError('');
    const response = await fetch('/api/dues/manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId: paymentSocio.household_id, periods: manualPeriods, action, method: action === 'paid' ? manualPaymentMethod : undefined }) });
    const result = await response.json();
    setPaymentSaving(false);
    if (!response.ok) { setPaymentManagementError(result.error ?? 'No fue posible actualizar la cuota.'); return; }
    setPaymentSocio(null); router.refresh();
  }

  async function decideApplication(application: MembershipApplication, decision: 'approve' | 'reject') {
    const reason = decision === 'reject' ? window.prompt('Indica el motivo del rechazo:')?.trim() : undefined;
    if (decision === 'reject' && !reason) return;
    setApplicationLoading(application.id); setApplicationError('');
    const response = await fetch(`/api/registration/applications/${application.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, reason }) });
    const result = await response.json();
    setApplicationLoading(null);
    if (!response.ok) { setApplicationError(result.error ?? 'No fue posible resolver la solicitud.'); return; }
    router.refresh();
  }

  async function confirmDeleteSocio() {
    if (!deletingSocio || deleteConfirmation.trim().toLowerCase() !== 'eliminar') return;
    setDeleteLoading(true); setDeleteError('');
    const response = await fetch(`/api/members/${deletingSocio.id}`, { method: 'DELETE' });
    const result = await response.json();
    setDeleteLoading(false);
    if (!response.ok) { setDeleteError(result.error ?? 'No fue posible eliminar al vecino.'); return; }
    setDeletingSocio(null); setDeleteConfirmation(''); router.refresh();
  }

  async function cancelSubscription() {
    if (!confirm('¿Cancelar la suscripción mensual? La junta perderá acceso al dashboard y no se realizarán nuevas renovaciones.')) return;
    setSubscriptionMessage('');
    setCancellingSubscription(true);
    const response = await fetch('/api/mercadopago/subscriptions/cancel', { method: 'POST' });
    const result = await response.json();
    setCancellingSubscription(false);
    if (!response.ok) { setSubscriptionMessage(result.error ?? 'No fue posible cancelar la suscripción.'); return; }
    router.replace('/registro/pago');
    router.refresh();
  }

  async function copyRegistrationLink() {
    const link = `${window.location.origin}/registro?codigo=${junta.invite_code}`;
    try {
      await navigator.clipboard.writeText(link);
      setInviteCodeMessage('Enlace copiado. Compártelo con los vecinos de tu junta.');
    } catch {
      setInviteCodeMessage(`Código de registro: ${junta.invite_code}`);
    }
  }

  function canManageBoardRole(socio: Profile) {
    return isPresident && socio.id !== currentProfile.id && socio.board_position !== 'presidente';
  }

  function manualDueOptions(socio: Profile, action: ManualAction) {
    const current = `${currentChileBillingPeriod()}-01`;
    const known = dueHistory
      .filter((due) => due.household_id === socio.household_id)
      .filter((due, index, all) => all.findIndex((candidate) => candidate.period === due.period) === index)
      .map((due) => ({ ...due, period: due.period.slice(0, 10) }));
    if (action === 'pending') {
      return known
        .filter((due) => due.status === 'paid' && due.payment_source === 'manual')
        .sort((left, right) => left.period.localeCompare(right.period));
    }

    const options = known.filter((due) => ['pending', 'rejected', 'refunded'].includes(due.status));
    const currentDate = new Date(`${current}T00:00:00Z`);
    const incorporationDate = householdCreatedAtById[socio.household_id]
      ? new Date(`${householdCreatedAtById[socio.household_id].slice(0, 7)}-01T00:00:00Z`)
      : currentDate;
    const firstGeneratedDate = incorporationDate > currentDate ? incorporationDate : currentDate;
    const lastGeneratedDate = new Date(currentDate);
    lastGeneratedDate.setUTCMonth(lastGeneratedDate.getUTCMonth() + 11);
    for (const generatedDate = new Date(firstGeneratedDate); generatedDate <= lastGeneratedDate; generatedDate.setUTCMonth(generatedDate.getUTCMonth() + 1)) {
      const period = `${generatedDate.getUTCFullYear()}-${String(generatedDate.getUTCMonth() + 1).padStart(2, '0')}-01`;
      if (!known.some((due) => due.period === period)) {
        options.push({ household_id: socio.household_id, period, status: 'pending', amount: Number(junta.monthly_due_amount ?? 0), payment_source: null, mercadopago_payment_id: null });
      }
    }
    return options.sort((left, right) => left.period.localeCompare(right.period));
  }

  function openPaymentModal(socio: Profile) {
    const manualPaidOptions = manualDueOptions(socio, 'paid');
    const manualReverseOptions = manualDueOptions(socio, 'pending');
    const initialAction: ManualAction = manualPaidOptions.length ? 'paid' : manualReverseOptions.length ? 'pending' : 'paid';
    const initialOptions = initialAction === 'paid' ? manualPaidOptions : manualReverseOptions;
    const current = `${currentChileBillingPeriod()}-01`;
    const initialPeriods = initialAction === 'paid'
      ? [initialOptions.find((due) => due.period === current)?.period ?? initialOptions[0]?.period].filter((period): period is string => Boolean(period))
      : selectCompleteManualBatches(initialOptions);
    setManualAction(initialAction);
    setManualPeriods(initialPeriods);
    setPaymentManagementError('');
    setPaymentSocio(socio);
  }

  function selectManualAction(action: ManualAction) {
    if (!paymentSocio) return;
    setManualAction(action);
    const options = manualDueOptions(paymentSocio, action);
    const current = `${currentChileBillingPeriod()}-01`;
    setManualPeriods(action === 'paid'
      ? [options.find((due) => due.period === current)?.period ?? options[0]?.period].filter((period): period is string => Boolean(period))
      : selectCompleteManualBatches(options));
    setPaymentManagementError('');
  }

  function currentManualOptions() {
    return paymentSocio ? manualDueOptions(paymentSocio, manualAction) : [];
  }

  function manualReverseGroups(options = currentManualOptions()) {
    const groups = new Map<string, DueHistoryItem[]>();
    for (const due of options) {
      const key = due.payment_batch_id ?? `single:${due.period}`;
      groups.set(key, [...(groups.get(key) ?? []), due].sort((left, right) => left.period.localeCompare(right.period)));
    }
    return [...groups.entries()].map(([key, periods]) => ({ key, periods }));
  }

  function selectCompleteManualBatches(options: DueHistoryItem[]) {
    const selected: string[] = [];
    for (const group of manualReverseGroups(options)) {
      if (selected.length + group.periods.length > 12) break;
      selected.push(...group.periods.map((due) => due.period));
    }
    return selected.sort();
  }

  function toggleManualPeriod(due: DueHistoryItem, checked: boolean) {
    if (manualAction !== 'pending' || !due.payment_batch_id) {
      setManualPeriods((current) => checked
        ? current.length >= 12 ? current : [...new Set([...current, due.period])].sort()
        : current.filter((period) => period !== due.period));
      return;
    }
    const group = manualReverseGroups().find(({ key }) => key === due.payment_batch_id)?.periods ?? [due];
    setManualPeriods((current) => {
      const groupPeriods = group.map((item) => item.period);
      if (checked) {
        if (current.length + groupPeriods.filter((period) => !current.includes(period)).length > 12) return current;
        return [...new Set([...current, ...groupPeriods])].sort();
      }
      const periods = new Set(groupPeriods);
      return current.filter((period) => !periods.has(period));
    });
  }

  /*
   * Keep the two operations separate in the UI. SQL remains the authority for
   * provider locks and complete-batch reversals; the reverse list only exposes
   * rows explicitly marked as manual.
   */
  function renderManualPaymentModal() {
    if (!paymentSocio) return null;
    const options = currentManualOptions();
    const reverseGroups = manualAction === 'pending' ? manualReverseGroups(options) : [];
    return <div className="modal active" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && setPaymentSocio(null)}><div className="modal-dialog"><div className="modal-content"><div className="modal-header"><h3 className="modal-title">Gestionar cuotas de {paymentSocio.name}</h3><button className="modal-close" onClick={() => setPaymentSocio(null)} aria-label="Cerrar">×</button></div><div className="modal-body"><div className="view-actions mb-16"><button type="button" className={`btn btn-sm ${manualAction === 'paid' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => selectManualAction('paid')}>Registrar pago manual</button><button type="button" className={`btn btn-sm ${manualAction === 'pending' ? 'btn-primary' : 'btn-secondary'}`} disabled={!manualDueOptions(paymentSocio, 'pending').length} onClick={() => selectManualAction('pending')}>Revertir pago manual</button></div><p className="card-subtitle">{manualAction === 'paid' ? 'Selecciona períodos pendientes o rechazados para registrar el pago fuera de Mercado Pago.' : 'Selecciona un lote completo. Los pagos de Mercado Pago quedan fuera de esta reversa.'}</p>{manualAction === 'pending' && <p className="form-help">Cada bloque corresponde a un pago manual completo; no puedes revertir solo una parte.</p>}<div className="due-period-grid">{manualAction === 'pending' ? reverseGroups.map((group) => <label className="due-period-option due-period-batch-option" key={group.key}><input type="checkbox" checked={group.periods.every((due) => manualPeriods.includes(due.period))} onChange={(event) => toggleManualPeriod(group.periods[0], event.target.checked)} /><span><strong>{group.periods.length} cuotas manuales</strong><small>{group.periods.map((due) => due.period.slice(0, 7)).join(', ')} · {new Intl.NumberFormat('es-CL').format(group.periods.reduce((sum, due) => sum + due.amount, 0))} CLP</small></span></label>) : options.map((due) => <label className="due-period-option" key={due.period}><input type="checkbox" checked={manualPeriods.includes(due.period)} onChange={(event) => toggleManualPeriod(due, event.target.checked)} /><span>{due.period.slice(0, 7)} · {new Intl.NumberFormat('es-CL').format(due.amount)} CLP</span></label>)}</div>{manualAction === 'paid' ? <><div className="form-group"><label className="form-label" htmlFor="manual-payment-method">Medio de pago recibido</label><select id="manual-payment-method" className="form-input" value={manualPaymentMethod} onChange={(event) => setManualPaymentMethod(event.target.value as 'cash' | 'transfer' | 'other')}><option value="cash">Efectivo</option><option value="transfer">Transferencia bancaria</option><option value="other">Otro medio manual</option></select></div><button className="btn btn-primary btn-block" disabled={paymentSaving || !manualPeriods.length} onClick={() => void updateManualPayment('paid')}>{paymentSaving ? 'Registrando…' : `Registrar ${manualPeriods.length} cuota${manualPeriods.length === 1 ? '' : 's'} pagada${manualPeriods.length === 1 ? '' : 's'}`}</button></> : <button className="btn btn-secondary danger-action btn-block" disabled={paymentSaving || !manualPeriods.length} onClick={() => void updateManualPayment('pending')}>{paymentSaving ? 'Revirtiendo…' : `Revertir ${manualPeriods.length} cuota${manualPeriods.length === 1 ? '' : 's'} manual${manualPeriods.length === 1 ? '' : 'es'}`}</button>}{!options.length && <p className="empty-state">No hay períodos disponibles para esta operación.</p>}{paymentManagementError && <p className="form-error">{paymentManagementError}</p>}</div></div></div></div>;
  }

  return (
    <section className="app-view active" id="view-socios">
      <header className="view-header"><div><span className="view-subtitle">Organización y Padrón Vecinal</span><h2 className="view-title">Registro de Socios</h2></div><div className="view-actions"><button className="tour-help-btn"><span>?</span><span>Guía</span></button>{isDirigente && <button className="btn btn-primary" onClick={() => setShowModal(true)}><span aria-hidden="true">＋</span> Inscribir Nuevo Socio</button>}</div></header>

      {isDirigente ? <>
        <div className="board-position-panel shadow-box"><div><span className="view-subtitle">Ingreso controlado de socios</span><h3 className="card-title">Código de la junta: {junta.invite_code}</h3><p>El enlace permite solicitar ingreso a {junta.name}. {hasSecretary ? 'Secretaría' : 'Presidencia, mientras no exista Secretaría,'} debe aprobar cada solicitud antes de habilitar la cuenta; toda la directiva recibe copia.</p></div><div className="board-position-control"><button type="button" className="btn btn-primary" onClick={() => void copyRegistrationLink()}>Copiar enlace de solicitud</button>{inviteCodeMessage && <span className="form-help">{inviteCodeMessage}</span>}</div></div>
        <div className="card shadow-box mb-24"><div className="card-header"><div><span className="view-subtitle">Bandeja de solicitudes</span><h3 className="card-title">Solicitudes de ingreso ({applications.length})</h3></div></div><p className="card-subtitle">La directiva puede revisar las cartas. {hasSecretary ? 'Secretaría resuelve cada solicitud.' : 'Mientras no exista Secretaría, Presidencia o el titular de la junta puede resolverlas.'}</p><div className="past-polls-list">{applications.map((application) => <article className="past-poll-row" key={application.id}><div className="past-poll-info"><h4 className="past-poll-title">{application.name}</h4><p className="past-poll-desc">RUT {formatRUT(application.rut)} · {application.address} · {application.email}</p><span className="form-help">Carta: {application.letter_delivery_status === 'sent' ? 'correo enviado y copia interna' : application.letter_delivery_status === 'failed' ? 'copia interna; correo no entregado' : 'copia interna'}</span></div>{canReviewApplications ? <div className="view-actions"><button className="btn btn-sm btn-secondary danger-action" disabled={applicationLoading === application.id} onClick={() => void decideApplication(application, 'reject')}>Rechazar</button><button className="btn btn-sm btn-primary" disabled={applicationLoading === application.id} onClick={() => void decideApplication(application, 'approve')}>{applicationLoading === application.id ? 'Procesando…' : 'Aceptar e invitar'}</button></div> : <span className="status-badge pendiente">Pendiente de la persona responsable</span>}</article>)}{!applications.length && <p className="empty-state">No hay solicitudes pendientes.</p>}</div>{applicationError && <p className="form-error">{applicationError}</p>}</div>
        <div className="board-position-panel shadow-box"><div><span className="view-subtitle">Tu función en la directiva</span><h3 className="card-title">Cargo: {boardPositionLabel(currentProfile.board_position)}</h3><p>{isPresident ? 'Presidencia asigna Secretario, Tesorero y Dirigente desde el padrón. La Presidencia no se transfiere aquí.' : 'Los cargos de la directiva los administra Presidencia. Presidente, Secretario y Tesorero son únicos.'}</p></div></div>
        {isOwner && <div className="board-position-panel shadow-box"><div><span className="view-subtitle">Plan de la junta</span><h3 className="card-title">Suscripción mensual activa</h3><p>{new Intl.NumberFormat("es-CL").format(junta.subscription_price)} CLP al mes, IVA incluido. Mercado Pago gestiona la renovación automática.</p></div><div className="board-position-control"><button type="button" className="btn btn-secondary danger-action" disabled={cancellingSubscription} onClick={() => void cancelSubscription()}>{cancellingSubscription ? 'Cancelando…' : 'Cancelar suscripción'}</button>{subscriptionMessage && <span className="form-help">{subscriptionMessage}</span>}</div></div>}
                <form className="roster-filters" onSubmit={applyRosterFilters} aria-label="Filtros del padrón">
          <div className="search-input-wrapper"><label className="sr-only" htmlFor="roster-search">Buscar socio</label><span className="search-icon" aria-hidden="true">⌕</span><input id="roster-search" name="q" defaultValue={initialSearch} className="form-input search-input" placeholder="Buscar socio por nombre, dirección o RUT…" /></div>
          <select name="role" className="form-input" defaultValue={initialFilters.role} aria-label="Filtrar por tipo"><option value="">Todos los tipos</option><option value="vecino">Vecinos</option><option value="dirigente">Directiva</option></select>
          <select name="position" className="form-input" defaultValue={initialFilters.position} aria-label="Filtrar por cargo"><option value="">Todos los cargos</option>{ASSIGNABLE_BOARD_POSITIONS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}<option value="presidente">Presidente</option></select>
          <select name="due" className="form-input" defaultValue={initialFilters.due} aria-label="Filtrar por cuota"><option value="">Todas las cuotas</option><option value="al_dia">Al día</option><option value="pendiente">Pendientes</option></select>
          <button className="btn btn-secondary" type="submit">Buscar</button>
          <div className="roster-meta"><span className="meta-label">Total en Padrón:</span><strong className="meta-value">{totalSocios} {totalSocios === 1 ? 'vecino' : 'vecinos'}</strong></div>
        </form>
        <div className="roster-grid">
          {filtered.map((socio) => <article className="socio-card" key={socio.id}><div className="socio-header"><div className="socio-info"><h4 className="socio-name"><strong>{socio.name}</strong></h4>{socio.role === 'dirigente' && <span className="board-role-badge">{boardPositionLabel(socio.board_position)}</span>}<span className="socio-rut">RUT: {formatRUT(socio.rut)}</span></div><span className={`status-badge ${socio.cuota_status === 'al_dia' ? 'al-dia' : 'pendiente'}`}>{socio.cuota_status === 'al_dia' ? 'Al Día' : 'Pendiente'}</span></div><div className="socio-details"><div className="socio-detail-item"><span aria-hidden="true">⌂</span><span>{socio.address} · cuota por domicilio</span></div>{socio.phone && <div className="socio-detail-item"><span aria-hidden="true">☎</span><span>{socio.phone}</span></div>}{socio.email && <div className="socio-detail-item"><span aria-hidden="true">✉</span><span>{socio.email}</span></div>}</div><div className="socio-actions"><button className="btn btn-xs btn-ghost" title="Registrar o revertir pagos de este domicilio" onClick={() => openPaymentModal(socio)}>Gestionar Cuota del Domicilio</button>{canManageBoardRole(socio) && socio.role === 'vecino' && <button className="btn btn-xs btn-secondary" onClick={() => openBoardModal(socio, 'assign')}>Asignar a directiva</button>}{canManageBoardRole(socio) && socio.role === 'dirigente' && <><button className="btn btn-xs btn-secondary" onClick={() => openBoardModal(socio, 'change')}>Cambiar cargo</button><button className="btn btn-xs btn-secondary danger-action" onClick={() => openBoardModal(socio, 'remove')}>Quitar de directiva</button></>}{socio.role === 'vecino' && socio.id !== currentProfile.id && <button className="btn btn-xs btn-secondary danger-action" onClick={() => { setDeleteError(''); setDeleteConfirmation(''); setDeletingSocio(socio); }}>Eliminar</button>}</div></article>)}
          {!filtered.length && <div className="split-card full-width"><p>No se encontraron socios con el criterio ingresado.</p></div>}
        </div>
        <div className="transaction-pagination" aria-label="Paginación del padrón"><button className="btn btn-secondary" type="button" disabled={page <= 1} onClick={() => changeRosterPage(page - 1)}>← Anteriores</button><span>Página {page} de {totalPages}</span><button className="btn btn-secondary" type="button" disabled={page >= totalPages} onClick={() => changeRosterPage(page + 1)}>Siguientes →</button></div>
      </> : <div className="roster-grid vecino-profile-grid">
        <article className="card shadow-box vecino-profile-card"><div className="profile-card-heading"><div><span className="view-subtitle">Tu Ficha Vecinal</span><h3 className="card-title">Mis Datos de Socio</h3></div><span className={`status-badge ${currentProfile.cuota_status === 'al_dia' ? 'al-dia' : 'pendiente'}`}>{currentProfile.cuota_status === 'al_dia' ? 'Al Día' : 'Pendiente'}</span></div><dl className="profile-detail-list"><div><dt>Nombre:</dt><dd>{currentProfile.name}</dd></div><div><dt>RUT:</dt><dd>{formatRUT(currentProfile.rut)}</dd></div><div><dt>Dirección:</dt><dd>{currentProfile.address}</dd></div></dl><form className="contact-update-form" onSubmit={updateContact}><h4>Actualizar Datos de Contacto</h4><div className="form-group"><label className="form-label" htmlFor="myPhone">Teléfono de Contacto</label><input id="myPhone" name="phone" className="form-input" defaultValue={currentProfile.phone ?? ''} /></div><div className="form-group"><label className="form-label" htmlFor="myEmail">Correo Electrónico</label><input id="myEmail" name="email" type="email" className="form-input" defaultValue={currentProfile.email} required /></div>{contactSaved && <p className="form-message">{contactSaved}</p>}<button className="btn btn-primary btn-sm btn-block">Guardar Cambios de Contacto</button></form></article>
        <article className="card shadow-box vecino-profile-card"><span className="view-subtitle">Directiva de tu Junta</span><h3 className="card-title">Contacto de Directiva</h3><p className="card-subtitle">Comunícate con la directiva para certificados, beneficios o consultas de la comunidad.</p><div className="board-contact-list">{socios.filter((s) => s.role === 'dirigente').map((member) => <div className="board-contact" key={member.id}><div className="board-avatar">{member.name.charAt(0)}</div><div><strong>{member.name}</strong><span>{boardPositionLabel(member.board_position)}</span></div>{member.phone ? <a className="btn btn-secondary btn-sm" href={`tel:${member.phone}`}>Llamar</a> : <a className="btn btn-secondary btn-sm" href={`mailto:${member.email}`}>Email</a>}</div>)}</div></article>
      </div>}

      {renderManualPaymentModal()}

      {deletingSocio && <div className="modal active" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && setDeletingSocio(null)}><div className="modal-dialog"><div className="modal-content"><div className="modal-header"><h3 className="modal-title">Eliminar vecino del padrón</h3><button className="modal-close" onClick={() => setDeletingSocio(null)} aria-label="Cerrar">×</button></div><div className="modal-body"><p>Esta acción eliminará la cuenta y el acceso de <strong>{deletingSocio.name}</strong>. Los movimientos contables históricos permanecerán en el libro de caja.</p><div className="form-group"><label className="form-label" htmlFor="delete-member-confirmation">Escribe <strong>ELIMINAR</strong> para confirmar</label><input id="delete-member-confirmation" className="form-input" autoComplete="off" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder="ELIMINAR" /></div>{deleteError && <p className="form-error">{deleteError}</p>}<div className="modal-footer"><button className="btn btn-ghost" type="button" onClick={() => setDeletingSocio(null)}>Cancelar</button><button className="btn btn-secondary danger-action" type="button" disabled={deleteLoading || deleteConfirmation.trim().toLowerCase() !== 'eliminar'} onClick={() => void confirmDeleteSocio()}>{deleteLoading ? 'Eliminando…' : 'Eliminar definitivamente'}</button></div></div></div></div></div>}

      {boardModal && <div className="modal active" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && setBoardModal(null)}><div className="modal-dialog"><div className="modal-content"><div className="modal-header"><h3 className="modal-title">{boardModal.mode === 'remove' ? `Quitar de directiva a ${boardModal.socio.name}` : boardModal.mode === 'change' ? `Cambiar cargo de ${boardModal.socio.name}` : `Asignar a directiva a ${boardModal.socio.name}`}</h3><button className="modal-close" onClick={() => setBoardModal(null)} aria-label="Cerrar">×</button></div><div className="modal-body">{boardModal.mode === 'remove' ? <p className="card-subtitle">La cuenta, el domicilio, las cuotas y el historial se conservan. {boardModal.socio.name} quedará como vecino del padrón, sin cargo de directiva.</p> : <><p className="card-subtitle">Elige Secretario, Tesorero o Dirigente. La Presidencia no se transfiere desde aquí.</p><div className="form-group"><label className="form-label" htmlFor="board-role-position">Cargo</label><select id="board-role-position" className="form-input" value={boardPositionChoice} onChange={(event) => setBoardPositionChoice(event.target.value as AssignableBoardPosition)}>{ASSIGNABLE_BOARD_POSITIONS.map((position) => <option value={position.value} key={position.value}>{position.label}</option>)}</select></div></>}{boardRoleError && <p className="form-error">{boardRoleError}</p>}<div className="modal-footer"><button className="btn btn-ghost" type="button" onClick={() => setBoardModal(null)}>Cancelar</button>{boardModal.mode === 'remove' ? <button className="btn btn-secondary danger-action" type="button" disabled={boardRoleLoading} onClick={() => void submitBoardRole(null)}>{boardRoleLoading ? 'Quitando…' : 'Quitar de directiva'}</button> : <button className="btn btn-primary" type="button" disabled={boardRoleLoading} onClick={() => void submitBoardRole(boardPositionChoice)}>{boardRoleLoading ? 'Guardando…' : boardModal.mode === 'change' ? 'Cambiar cargo' : 'Asignar a directiva'}</button>}</div></div></div></div></div>}

      {showModal && <div className="modal active" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && setShowModal(false)}><div className="modal-dialog"><div className="modal-content"><div className="modal-header"><h3 className="modal-title">Inscribir integrante</h3><button className="modal-close" onClick={() => setShowModal(false)} aria-label="Cerrar">×</button></div><div className="modal-body"><p className="card-subtitle">La persona recibirá un correo para activar su acceso.</p><form onSubmit={handleAddSocio}><div className="form-group"><label className="form-label">Nombre completo</label><input name="name" className="form-input" required /></div><div className="form-group"><label className="form-label">RUT</label><input name="rut" className="form-input" placeholder="12.345.678-9" required /></div><div className="form-group"><label className="form-label">Dirección</label><input name="address" className="form-input" required /></div><div className="form-row"><div className="form-group"><label className="form-label">Celular</label><input name="phone" type="tel" className="form-input" placeholder="+56 9 1234 5678" required /></div><div className="form-group"><label className="form-label">Correo electrónico</label><input name="email" type="email" className="form-input" required /></div></div>{isPresident ? <div className="form-row"><div className="form-group"><label className="form-label">Tipo de integrante</label><select className="form-input" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as UserRole)}><option value="vecino">Vecino</option><option value="dirigente">Dirigente</option></select></div>{inviteRole === 'dirigente' && <div className="form-group"><label className="form-label">Cargo</label><select className="form-input" value={invitePosition} onChange={(event) => setInvitePosition(event.target.value as AssignableBoardPosition)}>{ASSIGNABLE_BOARD_POSITIONS.map((position) => <option value={position.value} key={position.value}>{position.label}</option>)}</select></div>}</div> : <p className="form-help">La inscripción agrega un vecino al padrón. Solo Presidencia puede asignar cargos de directiva.</p>}{formError && <p className="form-error">{formError}</p>}<div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button><button className="btn btn-primary" disabled={loading}>{loading ? 'Enviando…' : 'Enviar Invitación'}</button></div></form></div></div></div></div>}
    </section>
  );
}
