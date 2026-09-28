import { currentChileBillingPeriod } from '@/lib/billing-period';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Metadata } from 'next';
import InicioAlerts from '@/components/dashboard/inicio/InicioAlerts';

export const metadata: Metadata = { title: 'Panel de Inicio — JuntAPP' };

const Icon = ({ type }: { type: 'money' | 'members' | 'vote' | 'calendar' }) => {
  const paths = {
    money: <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    members: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></>,
    vote: <><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  };
  return <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[type]}</svg>;
};

export default async function InicioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*, juntas(name)').eq('id', user!.id).single();
  const juntaId = profile?.junta_id;
  const period = `${currentChileBillingPeriod()}-01`;
  const [{ count: sociosCount }, { data: paidDues }, { data: transactions }, { data: announcements }, { data: activePoll }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('junta_id', juntaId),
    supabase.from('member_dues').select('household_id').eq('junta_id', juntaId).eq('period', period).eq('status', 'paid').not('household_id', 'is', null),
    supabase.from('transactions').select('type, amount').eq('junta_id', juntaId),
    supabase.from('announcements').select('*').eq('junta_id', juntaId).order('created_at', { ascending: false }).limit(3),
    supabase.from('polls').select('title').eq('junta_id', juntaId).eq('active', true).maybeSingle(),
  ]);
  const income = transactions?.filter((t) => t.type === 'ingreso').reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;
  const expenses = transactions?.filter((t) => t.type === 'egreso').reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;
  const paid = new Set((paidDues ?? []).map((due) => due.household_id)).size;
  const myDuePaid = (paidDues ?? []).some((due) => due.household_id === profile?.household_id);
  const junta = Array.isArray(profile?.juntas) ? profile.juntas[0]?.name : profile?.juntas?.name;
  const month = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date());
  const urgent = announcements?.find((item) => item.category === 'urgente');

  return (
    <section className="app-view active" id="view-inicio">
      <header className="view-header">
        <div><span className="view-subtitle">{junta ?? 'Mi Junta de Vecinos'}</span><h2 className="view-title">Panel de Inicio</h2></div>
        <div className="view-actions"><button className="tour-help-btn"><span>?</span><span>Guía</span></button><div className="date-badge">{month.charAt(0).toUpperCase() + month.slice(1)}</div></div>
      </header>

      <InicioAlerts urgent={urgent?.content} isDirigente={profile?.role === 'dirigente'} />

      <div className="stats-grid">
        <div className="stat-card note-yellow-v3"><div className="stat-icon income"><Icon type="money" /></div><div className="stat-details"><span className="stat-label">Caja Disponible</span><h3 className="stat-value">{formatCurrency(income - expenses)}</h3><span className="stat-trend success">✔ Cuentas transparentes</span></div></div>
        <div className="stat-card note-blue-v3"><div className="stat-icon members"><Icon type="members" /></div><div className="stat-details"><span className="stat-label">Socios Registrados</span><h3 className="stat-value">{sociosCount ?? 0}</h3><span className="stat-trend">{paid} domicilios con cuota al día</span></div></div>
        <Link className="stat-card select-action note-orange-v3" href="/consultas"><div className="stat-icon voting"><Icon type="vote" /></div><div className="stat-details"><span className="stat-label">Consulta Activa</span><h3 className="stat-value text-accent">{activePoll?.title ?? 'Sin consulta activa'}</h3><span className="stat-trend accent">{activePoll ? 'Participa ahora' : 'Te avisaremos de la próxima'}</span></div></Link>
        <div className="stat-card note-green-v3"><div className="stat-icon event"><Icon type="calendar" /></div><div className="stat-details"><span className="stat-label">Cuota de mi Domicilio</span><h3 className="stat-value">{myDuePaid ? 'Al Día' : 'Pendiente'}</h3><span className="stat-trend">{profile?.address}</span></div></div>
      </div>

      <div className="split-grid">
        <div className="split-card main-split"><div className="card-header"><h3 className="card-title">Anuncios Recientes</h3><Link className="btn btn-sm btn-ghost" href="/comunicaciones">Ver todos</Link></div><div className="announcements-preview-list">
          {announcements?.length ? announcements.map((item) => <article className="announcement-preview-item" key={item.id}><div><span className={`announcement-cat-badge ${item.category}`}>{item.category.toUpperCase()}</span><strong>{item.title}</strong><p>{item.content}</p></div><time>{formatDate(item.date)}</time></article>) : <p className="empty-state">No hay anuncios recientes.</p>}
        </div></div>
        <div className="split-card side-split text-card"><div className="welcome-box"><h3 className="card-title outfit-font">Hola, {profile?.name?.split(' ')[0]}</h3><p>Esta plataforma mantiene toda la información importante de tu junta clara y a mano.</p><ul className="accessibility-list"><li><span className="list-bullet">✔</span><span><strong>Letra grande</strong> y alto contraste.</span></li><li><span className="list-bullet">✔</span><span><strong>Transparencia</strong> de caja disponible.</span></li><li><span className="list-bullet">✔</span><span><strong>Participación</strong> digital segura.</span></li></ul><div className="help-action-box"><span className="help-text">¿Necesitas revisar un aviso?</span><Link href="/comunicaciones" className="btn btn-success btn-block">Ir a Anuncios</Link></div></div></div>
      </div>
    </section>
  );
}
