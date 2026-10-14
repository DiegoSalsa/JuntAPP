'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiArrowLeft, FiCheckCircle, FiHome, FiLoader, FiUserPlus } from 'react-icons/fi';
import { CHILE_REGIONS, getCommunes } from '@/lib/chile-locations';
import { formatCLP, PLANS, subscriptionPrice, type PlanId } from '@/lib/plans';
import { createJuntaAction, getTrialRequestForConversionAction } from '../../actions';

type Benefit = 'immediate' | 'free_1' | 'free_3' | 'free_6' | 'free_12' | 'complimentary';
type TrialRequest = {
  id: string; contact_name: string; email: string; phone: string; board_role: string;
  junta_name: string; region: string; comuna: string; requested_plan: string; status: string;
};

const benefits: Array<{ value: Benefit; title: string; detail: string }> = [
  { value: 'immediate', title: 'Cobro inmediato', detail: 'El titular activa Mercado Pago antes de entrar.' },
  { value: 'free_1', title: '1 mes gratis', detail: 'Acceso sin tarjeta; después requiere suscripción.' },
  { value: 'free_3', title: '3 meses gratis', detail: 'Acceso sin tarjeta; después requiere suscripción.' },
  { value: 'free_6', title: '6 meses gratis', detail: 'Acceso sin tarjeta; después requiere suscripción.' },
  { value: 'free_12', title: '12 meses gratis', detail: 'Acceso sin tarjeta; después requiere suscripción.' },
  { value: 'complimentary', title: 'Cortesía', detail: 'Acceso manual sin fecha de vencimiento ni cobro.' },
];

const inputClass = 'mt-2 w-full border-2 border-black bg-white px-3 py-2.5 text-sm font-bold outline-none focus:shadow-[3px_3px_0_#f97316]';

export default function NuevaJuntaPage() {
  const router = useRouter();
  const [region, setRegion] = useState('Biobío');
  const [comuna, setComuna] = useState('Concepción');
  const [plan, setPlan] = useState<PlanId>('juntapp');
  const [whatsapp, setWhatsapp] = useState(false);
  const [benefit, setBenefit] = useState<Benefit>('immediate');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [trialRequest, setTrialRequest] = useState<TrialRequest | null>(null);
  const communes = useMemo(() => getCommunes(region), [region]);
  const price = subscriptionPrice(plan, whatsapp);

  useEffect(() => {
    const requestId = new URLSearchParams(window.location.search).get('solicitud');
    if (!requestId) return;
    void getTrialRequestForConversionAction(requestId).then((result) => {
      if (!result.ok) { setFeedback({ ok: false, message: result.message }); return; }
      const request = result.request as TrialRequest;
      setTrialRequest(request);
      setRegion(request.region);
      setComuna(request.comuna);
      if (request.requested_plan in PLANS) setPlan(request.requested_plan as PlanId);
      setBenefit('free_1');
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFeedback(null);
    const form = new FormData(event.currentTarget);
    const result = await createJuntaAction({
      trialRequestId: trialRequest?.id,
      name: String(form.get('name') ?? ''),
      address: String(form.get('address') ?? ''),
      region,
      comuna,
      ownerName: String(form.get('ownerName') ?? ''),
      ownerEmail: String(form.get('ownerEmail') ?? ''),
      ownerRut: String(form.get('ownerRut') ?? ''),
      ownerAddress: String(form.get('ownerAddress') ?? ''),
      ownerPhone: String(form.get('ownerPhone') ?? ''),
      plan,
      whatsappAddon: whatsapp,
      benefit,
      billingNotes: String(form.get('billingNotes') ?? ''),
    });
    setFeedback(result);
    setPending(false);
    if (result.ok && result.juntaId) {
      window.setTimeout(() => {
        router.push(`/superadmin/juntas/${result.juntaId}`);
        router.refresh();
      }, 900);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <Link href="/superadmin/juntas" className="mb-4 inline-flex items-center gap-2 text-xs font-black uppercase text-slate-500 hover:text-[#f97316]">
          <FiArrowLeft /> Volver a juntas
        </Link>
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#f97316]">Alta administrada</p>
        <h1 className="text-3xl font-black uppercase tracking-tighter sm:text-4xl">Agregar junta de vecinos</h1>
        <p className="mt-1 text-sm font-bold text-slate-500">Crea la organización, invita a Presidencia y define desde el inicio cómo se cobrará.</p>
      </header>

      <form key={trialRequest?.id ?? 'manual'} onSubmit={submit} className="space-y-6">
        {trialRequest && <section className="border-4 border-black bg-[#fff4c2] p-4 shadow-[4px_4px_0_#000]">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#f97316]">Solicitud de prueba cargada</p>
          <p className="mt-1 text-sm font-black">{trialRequest.contact_name} · {trialRequest.email} · {trialRequest.phone}</p>
          {trialRequest.board_role !== 'presidente' && <p className="mt-1 text-xs font-bold text-slate-600">La persona solicitante indicó otro rol. Completa abajo los datos de Presidencia antes de crear la junta.</p>}
        </section>}
        <section className="border-4 border-black bg-white p-5 shadow-[5px_5px_0_#000] sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center border-2 border-black bg-[#9ee7ff]"><FiHome /></span>
            <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Paso 1</p><h2 className="font-black uppercase">Datos de la junta</h2></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-black uppercase tracking-wider sm:col-span-2">Nombre oficial
              <input name="name" required minLength={3} maxLength={160} defaultValue={trialRequest?.junta_name ?? ''} placeholder="Junta de Vecinos Villa Esperanza" className={inputClass} />
            </label>
            <label className="text-xs font-black uppercase tracking-wider sm:col-span-2">Dirección de la sede
              <input name="address" required minLength={3} maxLength={300} placeholder="Pasaje Los Aromos 245" className={inputClass} />
            </label>
            <label className="text-xs font-black uppercase tracking-wider">Región
              <select value={region} onChange={(event) => { const next = event.target.value; setRegion(next); setComuna(getCommunes(next)[0] ?? ''); }} className={inputClass}>
                {CHILE_REGIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-xs font-black uppercase tracking-wider">Comuna
              <select value={comuna} onChange={(event) => setComuna(event.target.value)} className={inputClass}>
                {communes.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="border-4 border-black bg-white p-5 shadow-[5px_5px_0_#000] sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center border-2 border-black bg-[#ffb5e8]"><FiUserPlus /></span>
            <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Paso 2</p><h2 className="font-black uppercase">Presidente titular</h2></div>
          </div>
          <p className="mb-4 border-2 border-black bg-[#fff4c2] p-3 text-xs font-bold">Recibirá un enlace seguro para crear su contraseña. No se generan contraseñas temporales.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-black uppercase tracking-wider">Nombre completo
              <input name="ownerName" required minLength={3} maxLength={160} defaultValue={trialRequest?.board_role === 'presidente' ? trialRequest.contact_name : ''} placeholder="María González" className={inputClass} />
            </label>
            <label className="text-xs font-black uppercase tracking-wider">Correo
              <input name="ownerEmail" type="email" required defaultValue={trialRequest?.board_role === 'presidente' ? trialRequest.email : ''} placeholder="presidencia@junta.cl" className={inputClass} />
            </label>
            <label className="text-xs font-black uppercase tracking-wider">RUT
              <input name="ownerRut" required placeholder="12.345.678-5" className={inputClass} />
            </label>
            <label className="text-xs font-black uppercase tracking-wider">Celular
              <input name="ownerPhone" type="tel" required defaultValue={trialRequest?.board_role === 'presidente' ? trialRequest.phone : ''} placeholder="+56 9 1234 5678" className={inputClass} />
            </label>
            <label className="text-xs font-black uppercase tracking-wider sm:col-span-2">Dirección particular
              <input name="ownerAddress" required minLength={3} maxLength={300} placeholder="Calle, número, villa o departamento" className={inputClass} />
            </label>
          </div>
        </section>

        <section className="border-4 border-black bg-white p-5 shadow-[5px_5px_0_#000] sm:p-6">
          <div className="mb-5"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Paso 3</p><h2 className="font-black uppercase">Plan y beneficio inicial</h2></div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(PLANS) as PlanId[]).map((item) => (
              <button key={item} type="button" onClick={() => setPlan(item)} className={`border-4 border-black p-4 text-left transition ${plan === item ? 'bg-[#9ee7ff] shadow-[3px_3px_0_#000]' : 'bg-white hover:bg-[#fffaf0]'}`}>
                <strong className="block text-sm uppercase">{PLANS[item].name}</strong>
                <span className="text-xs font-bold text-slate-500">${formatCLP(PLANS[item].price)} / mes</span>
              </button>
            ))}
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-3 border-2 border-black bg-[#eaffef] p-3 text-sm font-black">
            <input type="checkbox" checked={whatsapp} onChange={(event) => setWhatsapp(event.target.checked)} className="h-5 w-5 accent-emerald-600" />
            Agregar módulo WhatsApp (+$7.990 / mes)
          </label>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((item) => (
              <button key={item.value} type="button" onClick={() => setBenefit(item.value)} className={`border-4 border-black p-4 text-left transition ${benefit === item.value ? 'bg-[#bffcc6] shadow-[3px_3px_0_#000]' : 'bg-white hover:bg-[#fffaf0]'}`}>
                <strong className="block text-xs uppercase">{item.title}</strong>
                <span className="mt-1 block text-[11px] font-bold text-slate-500">{item.detail}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 border-2 border-black bg-[#071b34] p-4 text-white">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#f97316]">Condición resultante</p>
            <p className="mt-1 text-xl font-black">${formatCLP(price)} CLP / mes</p>
            <p className="text-xs font-bold text-white/65">
              {benefit === 'immediate'
                ? 'La junta quedará pendiente hasta que Presidencia autorice Mercado Pago.'
                : benefit === 'complimentary'
                  ? 'La junta quedará activa sin vencimiento automático.'
                  : 'La junta quedará activa sin tarjeta y, al vencer, solicitará Mercado Pago antes de permitir el acceso.'}
            </p>
          </div>
          <label className="mt-4 block text-xs font-black uppercase tracking-wider">Nota comercial interna
            <textarea name="billingNotes" maxLength={500} rows={3} placeholder="Motivo del beneficio, acuerdo comercial o referencia interna…" className={inputClass} />
          </label>
        </section>

        {feedback && (
          <p className={`border-4 border-black px-4 py-3 text-sm font-black ${feedback.ok ? 'bg-[#bffcc6]' : 'bg-[#ffb5e8]'}`}>
            {feedback.message}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/superadmin/juntas" className="border-4 border-black bg-white px-6 py-3 text-center text-xs font-black uppercase shadow-[3px_3px_0_#000]">Cancelar</Link>
          <button disabled={pending || Boolean(feedback?.ok)} className="flex items-center justify-center gap-2 border-4 border-black bg-[#f97316] px-6 py-3 text-xs font-black uppercase shadow-[3px_3px_0_#000] disabled:opacity-50">
            {pending ? <FiLoader className="animate-spin" /> : feedback?.ok ? <FiCheckCircle /> : <FiUserPlus />}
            {pending ? 'Creando e invitando…' : feedback?.ok ? 'Junta creada' : 'Crear junta'}
          </button>
        </div>
      </form>
    </div>
  );
}
