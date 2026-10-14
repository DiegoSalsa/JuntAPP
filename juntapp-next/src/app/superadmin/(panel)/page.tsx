import Link from 'next/link';
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowUpRight,
  FiCreditCard,
  FiDollarSign,
  FiHome,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type JuntaRow = {
  id: string;
  name: string;
  comuna: string | null;
  region: string;
  subscription_status: string;
  subscription_plan: string;
  subscription_price: number;
  billing_mode: string;
  created_at: string;
};

const statusLabels: Record<string, string> = {
  authorized: 'Activa',
  pending: 'Pendiente',
  paused: 'Pausada',
  past_due: 'Pago vencido',
  cancelled: 'Cancelada',
};

function money(value: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export default async function SuperadminDashboard() {
  const admin = createAdminClient();
  const monthStart = new Date();
  const weekStart = new Date(monthStart);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 7);

  const [
    juntasResult,
    memberCountsResult,
    treasuryResult,
    duesSummaryResult,
    applicationsResult,
    proposalsResult,
  ] = await Promise.all([
    admin.from('juntas').select('id, name, comuna, region, subscription_status, subscription_plan, subscription_price, billing_mode, created_at').order('created_at', { ascending: false }),
    admin.rpc('superadmin_member_counts'),
    admin.rpc('superadmin_treasury_summary', { p_from_date: monthStart.toISOString().slice(0, 10), p_to_date: null }),
    admin.rpc('superadmin_due_summary', { p_from_date: monthStart.toISOString() }),
    admin.from('membership_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('poll_proposals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const juntas = (juntasResult.data ?? []) as JuntaRow[];
  const memberCounts = (memberCountsResult.data ?? []) as { junta_id: string; members: number | string; leaders: number | string }[];
  const treasury = (treasuryResult.data?.[0] ?? {}) as { income?: number | string; expenses?: number | string };
  const duesSummary = (duesSummaryResult.data?.[0] ?? {}) as { collected?: number | string };
  const activeJuntas = juntas.filter((junta) => junta.subscription_status === 'authorized');
  const billableJuntas = activeJuntas.filter((junta) => junta.billing_mode === 'subscription');
  const trialJuntas = activeJuntas.filter((junta) => junta.billing_mode === 'trial_then_subscription');
  const attentionJuntas = juntas.filter((junta) => ['pending', 'past_due'].includes(junta.subscription_status));
  const mrr = billableJuntas.reduce((sum, junta) => sum + Number(junta.subscription_price || 0), 0);
  const newJuntas = juntas.filter((junta) => new Date(junta.created_at) >= weekStart).length;
  const totalMembers = memberCounts.reduce((sum, row) => sum + Number(row.members || 0), 0);
  const leaders = memberCounts.reduce((sum, row) => sum + Number(row.leaders || 0), 0);
  const collectedDues = Number(duesSummary.collected || 0);
  const income = Number(treasury.income || 0);
  const expenses = Number(treasury.expenses || 0);
  const membersByJunta = new Map<string, number>();
  for (const row of memberCounts) membersByJunta.set(row.junta_id, Number(row.members || 0));
  const topJuntas = [...juntas]
    .sort((a, b) => (membersByJunta.get(b.id) ?? 0) - (membersByJunta.get(a.id) ?? 0))
    .slice(0, 5);

  const cards = [
    { label: 'MRR estimado', value: money(mrr), detail: `${billableJuntas.length} suscripciones con cobro`, icon: FiDollarSign, color: 'bg-[#bffcc6]' },
    { label: 'Juntas activas', value: activeJuntas.length, detail: `${trialJuntas.length} con meses gratis`, icon: FiHome, color: 'bg-[#9ee7ff]' },
    { label: 'Usuarios', value: totalMembers, detail: `${leaders} integrantes de directiva`, icon: FiUsers, color: 'bg-[#ffb5e8]' },
    { label: 'Requieren atención', value: attentionJuntas.length, detail: `${applicationsResult.count ?? 0} solicitudes pendientes`, icon: FiAlertTriangle, color: 'bg-[#fff4a3]' },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#f97316]">Panorama de JuntAPP</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter sm:text-4xl">Panel Superadmin</h1>
          <p className="mt-1 text-sm font-bold text-slate-500">Métricas operacionales y comerciales en tiempo real.</p>
        </div>
        <Link href="/superadmin/juntas" className="flex w-fit items-center gap-2 border-4 border-black bg-[#f97316] px-5 py-3 text-sm font-black uppercase text-[#071b34] shadow-[4px_4px_0_#000] transition hover:translate-x-1 hover:translate-y-1 hover:shadow-none">
          Gestionar juntas <FiArrowUpRight />
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className={`border-4 border-black ${card.color} p-4 shadow-[6px_6px_0_#000] sm:p-5`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#071b34]/60 sm:text-xs">{card.label}</p>
              <card.icon className="shrink-0 opacity-55" />
            </div>
            <p className="text-2xl font-black tracking-tighter sm:text-4xl">{card.value}</p>
            <p className="mt-1 text-xs font-bold text-[#071b34]/55">{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="border-4 border-black bg-white p-5 shadow-[5px_5px_0_#000]">
          <FiCreditCard className="mb-2 text-[#f97316]" />
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Cuotas recaudadas este mes</p>
          <p className="mt-1 text-3xl font-black">{money(collectedDues)}</p>
        </article>
        <article className="border-4 border-black bg-white p-5 shadow-[5px_5px_0_#000]">
          <FiTrendingUp className="mb-2 text-emerald-600" />
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Movimiento de cajas</p>
          <p className="mt-1 text-3xl font-black">{money(income - expenses)}</p>
          <p className="text-xs font-bold text-slate-400">{money(income)} ingresos · {money(expenses)} egresos</p>
        </article>
        <article className="border-4 border-black bg-white p-5 shadow-[5px_5px_0_#000]">
          <FiActivity className="mb-2 text-sky-600" />
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Actividad pendiente</p>
          <p className="mt-1 text-3xl font-black">{(applicationsResult.count ?? 0) + (proposalsResult.count ?? 0)}</p>
          <p className="text-xs font-bold text-slate-400">{applicationsResult.count ?? 0} ingresos · {proposalsResult.count ?? 0} propuestas</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="border-4 border-black bg-white shadow-[6px_6px_0_#000]">
          <div className="border-b-4 border-black bg-[#9ee7ff] p-5">
            <h2 className="font-black uppercase">Juntas con más socios</h2>
            <p className="text-xs font-bold text-[#071b34]/55">Cobertura actual de la plataforma</p>
          </div>
          <div className="space-y-2 p-4">
            {topJuntas.map((junta, index) => (
              <Link key={junta.id} href={`/superadmin/juntas/${junta.id}`} className="flex items-center justify-between border-2 border-black bg-[#fffaf0] p-3 shadow-[2px_2px_0_#000] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center border-2 border-black bg-[#071b34] text-xs font-black text-white">#{index + 1}</span>
                  <span className="min-w-0">
                    <strong className="block truncate text-sm">{junta.name}</strong>
                    <small className="block truncate font-bold text-slate-400">{junta.comuna ?? junta.region}</small>
                  </span>
                </div>
                <span className="border-2 border-black bg-[#9ee7ff] px-2 py-1 text-xs font-black">{membersByJunta.get(junta.id) ?? 0} socios</span>
              </Link>
            ))}
            {!topJuntas.length && <p className="py-10 text-center text-sm font-bold text-slate-400">Aún no hay juntas registradas.</p>}
          </div>
        </article>

        <article className="border-4 border-black bg-white shadow-[6px_6px_0_#000]">
          <div className="flex items-center justify-between border-b-4 border-black bg-[#fff4a3] p-5">
            <div>
              <h2 className="font-black uppercase">Registros recientes</h2>
              <p className="text-xs font-bold text-[#071b34]/55">{newJuntas} nuevas durante los últimos 7 días</p>
            </div>
            <Link href="/superadmin/juntas" className="border-2 border-black bg-[#071b34] px-3 py-1.5 text-xs font-black uppercase text-white">Ver todas</Link>
          </div>
          <div className="space-y-2 p-4">
            {juntas.slice(0, 5).map((junta) => (
              <Link key={junta.id} href={`/superadmin/juntas/${junta.id}`} className="flex items-center justify-between gap-3 border-2 border-black bg-[#fffaf0] p-3 shadow-[2px_2px_0_#000] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none">
                <span className="min-w-0">
                  <strong className="block truncate text-sm">{junta.name}</strong>
                  <small className="font-bold text-slate-400">{shortDate(junta.created_at)}</small>
                </span>
                <span className={`shrink-0 border-2 border-black px-2 py-1 text-[10px] font-black uppercase ${junta.subscription_status === 'authorized' ? 'bg-[#bffcc6]' : junta.subscription_status === 'past_due' ? 'bg-[#ffb5e8]' : 'bg-[#fff4a3]'}`}>
                  {statusLabels[junta.subscription_status] ?? junta.subscription_status}
                </span>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
