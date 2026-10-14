import Link from 'next/link';
import { FiArrowRight, FiCalendar, FiMail, FiMapPin, FiPhone, FiUsers } from 'react-icons/fi';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLANS, type PlanId } from '@/lib/plans';
import { updateTrialRequestStatusAction } from '../actions';

type TrialStatus = 'new' | 'contacted' | 'converted' | 'discarded';
const statuses: Array<{ value: TrialStatus; label: string }> = [
  { value: 'new', label: 'Nueva' }, { value: 'contacted', label: 'Contactada' },
  { value: 'converted', label: 'Junta creada' }, { value: 'discarded', label: 'Descartada' },
];
const statusStyle: Record<TrialStatus, string> = {
  new: 'bg-[#fff4c2]', contacted: 'bg-[#9ee7ff]', converted: 'bg-[#bffcc6]', discarded: 'bg-slate-200',
};
const roleLabel: Record<string, string> = { presidente: 'Presidencia', secretario: 'Secretaría', tesorero: 'Tesorería', dirigente: 'Dirigente', otro: 'Otro rol' };

export default async function TrialRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const query = await searchParams;
  const selectedStatus = statuses.some((item) => item.value === query.status) ? query.status as TrialStatus : null;
  const admin = createAdminClient();
  let requestQuery = admin.from('trial_requests').select('*').order('created_at', { ascending: false }).limit(200);
  if (selectedStatus) requestQuery = requestQuery.eq('status', selectedStatus);
  const { data: requests, error } = await requestQuery;
  const items = requests ?? [];

  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#f97316]">Embudo comercial</p><h1 className="text-3xl font-black uppercase tracking-tighter sm:text-4xl">Solicitudes de prueba</h1><p className="mt-1 text-sm font-bold text-slate-500">Dirigentes que solicitaron el mes gratis desde el correo o el sitio.</p></div>
      <Link href="/superadmin/juntas/nueva" className="border-4 border-black bg-[#f97316] px-5 py-3 text-center text-xs font-black uppercase shadow-[3px_3px_0_#000]">Crear junta manualmente</Link>
    </header>

    <nav className="flex flex-wrap gap-2" aria-label="Filtrar solicitudes">
      <Link href="/superadmin/solicitudes-prueba" className={`border-2 border-black px-3 py-2 text-xs font-black uppercase ${!selectedStatus ? 'bg-[#071b34] text-white' : 'bg-white'}`}>Todas</Link>
      {statuses.map((item) => <Link key={item.value} href={`/superadmin/solicitudes-prueba?status=${item.value}`} className={`border-2 border-black px-3 py-2 text-xs font-black uppercase ${selectedStatus === item.value ? 'bg-[#071b34] text-white' : statusStyle[item.value]}`}>{item.label}</Link>)}
    </nav>

    {error && <p className="border-4 border-black bg-[#ffd2d2] p-4 font-black">No fue posible cargar las solicitudes: {error.message}</p>}
    {!error && items.length === 0 && <div className="border-4 border-dashed border-black bg-white p-10 text-center"><FiMail className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-black uppercase">No hay solicitudes en este estado</p></div>}

    <div className="grid gap-5 lg:grid-cols-2">
      {items.map((request) => {
        const status = request.status as TrialStatus;
        const plan = PLANS[(request.requested_plan in PLANS ? request.requested_plan : 'juntapp') as PlanId];
        const updateStatus = updateTrialRequestStatusAction.bind(null, request.id);
        return <article key={request.id} className="border-4 border-black bg-white shadow-[5px_5px_0_#000]">
          <div className={`flex items-start justify-between gap-4 border-b-4 border-black p-4 ${statusStyle[status]}`}>
            <div><span className="text-[10px] font-black uppercase tracking-[.18em]">{roleLabel[request.board_role] ?? request.board_role}</span><h2 className="text-xl font-black leading-tight">{request.contact_name}</h2><p className="mt-1 text-sm font-bold">{request.junta_name}</p></div>
            <span className="border-2 border-black bg-white px-2 py-1 text-[10px] font-black uppercase">{statuses.find((item) => item.value === status)?.label}</span>
          </div>
          <div className="space-y-3 p-4 text-sm font-semibold">
            <div className="grid gap-2 sm:grid-cols-2">
              <a href={`mailto:${request.email}`} className="flex items-center gap-2 break-all hover:text-[#f97316]"><FiMail /> {request.email}</a>
              <a href={`tel:${request.phone}`} className="flex items-center gap-2 hover:text-[#f97316]"><FiPhone /> {request.phone}</a>
              <span className="flex items-center gap-2"><FiMapPin /> {request.comuna}, {request.region}</span>
              <span className="flex items-center gap-2"><FiUsers /> {request.member_count ? `${request.member_count} vecinos aprox.` : 'Cantidad no indicada'}</span>
              <span className="flex items-center gap-2"><FiCalendar /> {new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(request.created_at))}</span>
              <span className="font-black text-[#f97316]">Interés: {plan.name}</span>
            </div>
            {request.message && <p className="border-2 border-black bg-[#fffaf0] p-3 text-sm leading-6">“{request.message}”</p>}
            {(request.utm_campaign || request.utm_content) && <p className="text-[10px] uppercase tracking-wide text-slate-400">Campaña: {request.utm_campaign ?? '—'} · Variante: {request.utm_content ?? '—'}</p>}
          </div>
          <div className="flex flex-col gap-3 border-t-4 border-black bg-[#fffaf0] p-4 sm:flex-row">
            <form action={updateStatus} className="flex flex-1 gap-2">
              <select name="status" defaultValue={status} className="min-w-0 flex-1 border-2 border-black bg-white px-2 py-2 text-xs font-black uppercase">{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <button className="border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase">Guardar</button>
            </form>
            {status !== 'converted' && <Link href={`/superadmin/juntas/nueva?solicitud=${request.id}`} className="flex items-center justify-center gap-2 border-2 border-black bg-[#f97316] px-4 py-2 text-xs font-black uppercase">Crear junta <FiArrowRight /></Link>}
          </div>
        </article>;
      })}
    </div>
  </div>;
}
