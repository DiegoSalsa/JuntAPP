import Link from 'next/link';
import InicioAlerts from './InicioAlerts';
import type { Junta, Profile } from '@/lib/types';
import { boardPositionLabel } from '@/lib/board';
import { formatCurrency, formatDate } from '@/lib/utils';

type Announcement = { id: number; category: string; title: string; content: string; date: string; author: string };
type Contact = { id?: string; name: string; board_position: string | null; phone?: string | null; email?: string | null };
type ActivePoll = { id: string; title: string };
type HomeProps = {
  profile: Profile;
  junta: Junta | null;
  month: string;
  announcements: Announcement[];
  urgent?: string;
  activePolls: ActivePoll[];
  activePollsError?: boolean;
  myDuePaid: boolean | null;
  myDueError?: boolean;
  period: string;
  treasury: { income: number; expenses: number; fees: number; balance: number } | null;
  treasuryError?: boolean;
  paidHouseholds: number | null;
  totalHouseholds: number | null;
  sociosCount: number | null;
  sociosCountError?: boolean;
  boardContacts: Contact[];
  pendingApplications: number | null;
  pendingProposals: number | null;
  canReviewApplications: boolean;
  canManageTreasury: boolean;
  canPublishPolls: boolean;
  canPublishAnnouncements: boolean;
};

const announcementLabel: Record<string, string> = { urgente: 'Urgente', asamblea: 'Asamblea', beneficio: 'Beneficio', general: 'General' };

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function formatPeriod(period: string) {
  return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'America/Santiago' }).format(new Date(`${period}T12:00:00`));
}

function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <div className="home-v2-section-heading"><div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>;
}

export default function InicioV2(props: HomeProps) {
  const { profile } = props;
  return profile.role === 'dirigente' ? <BoardHome {...props} /> : <NeighborHome {...props} />;
}

function NeighborHome({ profile, junta, month, announcements, urgent, activePolls, activePollsError, myDuePaid, myDueError, period, boardContacts, totalHouseholds }: HomeProps) {
  const firstName = profile.name.split(' ')[0];
  const dueAction = myDuePaid ? 'Ver mis cuotas' : 'Revisar y pagar';
  const activePoll = activePolls[0];
  const dueTitle = myDueError ? 'Cuota no disponible' : myDuePaid ? 'Gracias por estar al día' : `Tu cuota de ${formatPeriod(period)}`;
  return <section className="home-v2 home-v2-neighbor" id="view-inicio" data-home-role="vecino">
    <header className="home-v2-hero home-v2-hero-neighbor">
      <div><span className="home-v2-eyebrow">{junta?.name ?? 'Mi junta de vecinos'}</span><h1 aria-label="Panel de Inicio">Hola, {firstName}</h1><p>Todo lo importante de tu comunidad, claro y a mano.</p></div>
      <div className="home-v2-date"><span>Hoy</span><strong>{month}</strong></div>
    </header>
    {urgent && <Link href="/comunicaciones" className="home-v2-alert"><span className="home-v2-alert-icon">!</span><span><b>Aviso urgente</b>{urgent}</span><span aria-hidden="true">→</span></Link>}
    <div className="home-v2-focus-grid">
      <article className={`home-v2-focus-card home-v2-due-focus ${myDuePaid ? 'is-complete' : ''} ${myDueError ? 'is-unknown' : ''}`}>
        <div className="home-v2-focus-top"><span className="home-v2-eyebrow">Cuota de mi domicilio</span><span className="home-v2-status">{myDueError ? 'Sin información' : myDuePaid ? 'Al día' : 'Pendiente'}</span></div>
        <h2>{dueTitle}</h2>
        <p>{myDueError ? 'No pudimos consultar el estado de este período. Revisa Tesorería para intentarlo de nuevo.' : myDuePaid ? 'Tu aporte está registrado. Puedes revisar el historial cuando quieras.' : 'Revisa el detalle y elige el medio de pago que prefieras.'}</p>
        <Link href="/tesoreria" className="home-v2-primary-action">{myDueError ? 'Revisar Tesorería' : dueAction}<span aria-hidden="true">→</span></Link>
      </article>
      <article className="home-v2-focus-card home-v2-poll-focus">
        <div className="home-v2-focus-top"><span className="home-v2-eyebrow">Participación</span><span className="home-v2-icon-badge" aria-hidden="true">?</span></div>
        <h2>{activePollsError ? 'Consultas no disponibles' : activePoll ? 'Hay consultas abiertas' : 'Tu voz cuenta en la junta'}</h2>
        <p>{activePollsError ? 'No pudimos cargar las consultas de tu junta.' : activePoll ? `${activePoll.title}${activePolls.length > 1 ? ` · ${activePolls.length} disponibles` : ''}` : 'Cuando la directiva publique una consulta, podrás responderla desde aquí.'}</p>
        <Link href="/consultas" className="home-v2-secondary-action">{activePollsError ? 'Reintentar en Consultas' : activePoll ? 'Participar ahora' : 'Ver consultas'}<span aria-hidden="true">→</span></Link>
      </article>
    </div>
    <div className="home-v2-stat-strip" aria-label="Resumen de tu junta">
      <div><span>Domicilios registrados</span><strong>{totalHouseholds == null ? '—' : totalHouseholds}</strong></div>
      <div><span>Comunicados recientes</span><strong>{announcements.length}</strong></div>
      <div><span>Directiva disponible</span><strong>{boardContacts.length}</strong></div>
    </div>
    <div className="home-v2-content-grid">
      <section className="home-v2-panel home-v2-news-panel"><SectionHeading eyebrow="Mantente al tanto" title="Últimos avisos" action={<Link href="/comunicaciones" className="home-v2-text-link">Ver todos →</Link>} />
        <div className="home-v2-news-list">{announcements.slice(0, 3).map((item) => <Link href="/comunicaciones" className="home-v2-news-item" key={item.id}><span className={`home-v2-news-dot ${item.category}`} /><div><span className="home-v2-news-meta">{announcementLabel[item.category] ?? 'Comunidad'} · {formatDate(item.date)}</span><h3>{item.title}</h3><p>{item.content}</p></div><span aria-hidden="true">↗</span></Link>)}{!announcements.length && <p className="home-v2-empty">Aún no hay avisos publicados.</p>}</div>
      </section>
      <section className="home-v2-panel home-v2-contact-panel"><SectionHeading eyebrow="¿Necesitas ayuda?" title="Tu directiva" />
        <p className="home-v2-panel-intro">Contacta a las personas que coordinan tu junta.</p><div className="home-v2-contact-list">{boardContacts.slice(0, 3).map((contact) => <div className="home-v2-contact" key={contact.id ?? contact.email ?? contact.name}><span className="home-v2-avatar">{initials(contact.name)}</span><span><b>{contact.name}</b><small>{boardPositionLabel(contact.board_position as Parameters<typeof boardPositionLabel>[0])}</small></span>{contact.phone ? <a href={`tel:${contact.phone}`} aria-label={`Llamar a ${contact.name}`}>☎</a> : contact.email ? <a href={`mailto:${contact.email}`} aria-label={`Enviar correo a ${contact.name}`}>✉</a> : null}</div>)}{!boardContacts.length && <p className="home-v2-empty">Los contactos de tu directiva aparecerán aquí.</p>}</div><Link href="/socios" className="home-v2-text-link">Ver información de la junta →</Link>
      </section>
    </div>
    <section className="home-v2-setup"><SectionHeading eyebrow="Opcional" title="Instala JuntAPP y recibe avisos" /><InicioAlerts urgent={undefined} isDirigente={false} /></section>
  </section>;
}

function BoardHome({ profile, junta, month, announcements, urgent, activePolls, activePollsError, treasury, treasuryError, paidHouseholds, totalHouseholds, pendingApplications, pendingProposals, sociosCount, canReviewApplications, canManageTreasury, canPublishPolls, canPublishAnnouncements }: HomeProps) {
  const balance = treasury?.balance ?? 0;
  const activePoll = activePolls[0];
  const paidLabel = paidHouseholds == null || totalHouseholds == null ? 'Sin información' : `${paidHouseholds}/${totalHouseholds}`;
  const pendingTaskCount = (canReviewApplications && pendingApplications == null) || pendingProposals == null
    ? null
    : (canReviewApplications ? pendingApplications ?? 0 : 0) + (pendingProposals ?? 0);
  const tasks = [
    ...(canReviewApplications ? [{ label: 'Solicitudes de ingreso', value: pendingApplications == null ? '—' : pendingApplications, href: '/socios', tone: pendingApplications ? 'attention' : 'quiet', action: 'Revisar padrón' }] : []),
    { label: 'Propuestas por revisar', value: pendingProposals == null ? '—' : pendingProposals, href: '/consultas', tone: pendingProposals ? 'attention' : 'quiet', action: 'Abrir consultas' },
    { label: 'Consultas activas', value: activePollsError ? '—' : activePolls.length, href: '/consultas', tone: activePollsError ? 'quiet' : activePoll ? 'ready' : 'quiet', action: activePoll ? 'Ver resultados' : 'Abrir consultas' },
  ];
  return <section className="home-v2 home-v2-board" id="view-inicio" data-home-role="dirigente">
    <header className="home-v2-hero home-v2-hero-board"><div><span className="home-v2-eyebrow">Centro de operaciones · {junta?.name ?? 'Mi junta'}</span><h1 aria-label="Panel de Inicio">Hola, {profile.name.split(' ')[0]}</h1><p>Una vista clara para tomar decisiones y mantener la junta en movimiento.</p></div><div className="home-v2-board-role"><span>Tu cargo</span><strong>{boardPositionLabel(profile.board_position)}</strong><small>{month}</small></div></header>
    {urgent && <Link href="/comunicaciones" className="home-v2-alert"><span className="home-v2-alert-icon">!</span><span><b>Aviso urgente</b>{urgent}</span><span aria-hidden="true">→</span></Link>}
    <section className="home-v2-command-card"><div><span className="home-v2-eyebrow">Resumen de caja</span><h2>{treasuryError ? 'Caja no disponible' : treasury ? formatCurrency(balance) : 'Sin información'}</h2><p>{treasuryError ? 'Intenta actualizar la vista o revisar Tesorería.' : treasury ? 'Saldo neto registrado · transferencias internas excluidas' : 'El resumen aparecerá cuando existan datos disponibles.'}</p></div><div className="home-v2-command-numbers"><div><span>Ingresos</span><b>{treasury ? formatCurrency(treasury.income) : '—'}</b></div><div><span>Egresos</span><b>{treasury ? formatCurrency(treasury.expenses) : '—'}</b></div><div><span>Comisiones</span><b>{treasury ? formatCurrency(treasury.fees) : '—'}</b></div></div>{canManageTreasury && <Link href="/tesoreria" className="home-v2-primary-action">Abrir Tesorería <span aria-hidden="true">→</span></Link>}</section>
    <div className="home-v2-board-stats"><div><span>Cuotas al día</span><strong>{paidLabel}</strong><small>{totalHouseholds == null ? 'No disponible' : totalHouseholds === 0 ? 'Sin domicilios' : `${Math.round(((paidHouseholds ?? 0) / totalHouseholds) * 100)}% de domicilios`}</small></div><div><span>Socios registrados</span><strong>{sociosCount == null ? '—' : sociosCount}</strong><small>{sociosCount == null ? 'Sin información' : 'padrón activo'}</small></div><div><span>Tareas pendientes</span><strong>{pendingTaskCount == null ? '—' : pendingTaskCount}</strong><small>{pendingTaskCount == null ? 'Sin información' : 'requieren revisión'}</small></div></div>
    <section className="home-v2-task-section"><SectionHeading eyebrow="Siguiente paso" title="Tareas de la directiva" action={canReviewApplications ? <Link href="/socios" className="home-v2-text-link">Abrir padrón →</Link> : undefined} /><div className="home-v2-task-grid">{tasks.map((task) => <Link href={task.href} className={`home-v2-task ${task.tone}`} key={task.label}><span className="home-v2-task-count">{task.value}</span><span><b>{task.label}</b><small>{task.action} <span aria-hidden="true">→</span></small></span></Link>)}</div></section>
    <div className="home-v2-content-grid"><section className="home-v2-panel home-v2-news-panel"><SectionHeading eyebrow="Comunicación" title="Últimos avisos" action={canPublishAnnouncements ? <Link href="/comunicaciones" className="home-v2-text-link">Publicar →</Link> : undefined} /><div className="home-v2-news-list">{announcements.slice(0, 3).map((item) => <Link href="/comunicaciones" className="home-v2-news-item" key={item.id}><span className={`home-v2-news-dot ${item.category}`} /><div><span className="home-v2-news-meta">{announcementLabel[item.category] ?? 'Comunidad'} · {formatDate(item.date)}</span><h3>{item.title}</h3><p>{item.content}</p></div><span aria-hidden="true">↗</span></Link>)}{!announcements.length && <p className="home-v2-empty">Aún no hay avisos publicados.</p>}</div></section><section className="home-v2-panel home-v2-shortcuts-panel"><SectionHeading eyebrow="Acciones rápidas" title="Gestiona tu junta" /><div className="home-v2-shortcut-list"><Link href="/socios"><span>01</span><b>Actualizar padrón</b><i>→</i></Link>{canManageTreasury && <Link href="/tesoreria"><span>02</span><b>Registrar movimiento</b><i>→</i></Link>}{canPublishPolls && <Link href="/consultas"><span>03</span><b>Publicar consulta</b><i>→</i></Link>}{canPublishAnnouncements && <Link href="/comunicaciones"><span>04</span><b>Enviar aviso</b><i>→</i></Link>}</div></section></div>
    <section className="home-v2-setup"><SectionHeading eyebrow="Centro secundario" title="Instalación y avisos push" /><InicioAlerts urgent={undefined} isDirigente /></section>
  </section>;
}
