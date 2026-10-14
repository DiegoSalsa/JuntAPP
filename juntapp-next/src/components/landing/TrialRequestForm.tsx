'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { CHILE_REGIONS, getCommunes } from '@/lib/chile-locations';
import { PLANS, type PlanId } from '@/lib/plans';

type Tracking = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
};

const fieldClass = 'trial-request-field mt-2 w-full border-2 border-[#071b34] bg-white px-3 py-3 text-sm font-bold text-[#071b34] outline-none transition focus:shadow-[3px_3px_0_#f97316]';

export default function TrialRequestForm({ initialPlan, tracking }: { initialPlan: PlanId; tracking: Tracking }) {
  const [region, setRegion] = useState('Biobío');
  const [comuna, setComuna] = useState('Concepción');
  const [plan, setPlan] = useState<PlanId>(initialPlan);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const communes = useMemo(() => getCommunes(region), [region]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/trial-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: form.get('contactName'),
          email: form.get('email'),
          phone: form.get('phone'),
          boardRole: form.get('boardRole'),
          juntaName: form.get('juntaName'),
          region,
          comuna,
          memberCount: form.get('memberCount') || null,
          requestedPlan: plan,
          message: form.get('message') || null,
          website: form.get('website'),
          consent: form.get('consent') === 'on',
          source: 'trial_request_page',
          ...tracking,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'No fue posible registrar la solicitud.');
      setSuccess(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible registrar la solicitud.');
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return <div className="border-4 border-[#071b34] bg-[#c9f7d4] p-7 text-center shadow-[6px_6px_0_#071b34]">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border-2 border-[#071b34] bg-white text-2xl font-black">✓</span>
      <h2 className="mt-4 text-2xl font-black uppercase tracking-tight">Solicitud recibida</h2>
      <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-[#425168]">Ya aparece en el panel de JuntAPP. Nuestro equipo revisará los datos y se pondrá en contacto para crear la junta de forma personalizada.</p>
    </div>;
  }

  return <form onSubmit={submit} className="border-4 border-[#071b34] bg-[#fffdf8] p-5 shadow-[7px_7px_0_#071b34] sm:p-7">
    <div className="mb-6">
      <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#f15a24]">Solicitud personalizada</p>
      <h2 className="mt-1 text-2xl font-black uppercase tracking-tight sm:text-3xl">Cuéntanos sobre tu junta</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#526071]">Con estos datos podremos preparar el espacio correcto y contactar a la persona responsable.</p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-black uppercase tracking-wide">Nombre completo
        <input name="contactName" required minLength={3} maxLength={160} autoComplete="name" className={fieldClass} placeholder="María González" />
      </label>
      <label className="text-xs font-black uppercase tracking-wide">Rol en la directiva
        <select name="boardRole" required className={fieldClass} defaultValue="presidente">
          <option value="presidente">Presidente/a</option><option value="secretario">Secretario/a</option><option value="tesorero">Tesorero/a</option><option value="dirigente">Otro/a dirigente</option><option value="otro">Otro</option>
        </select>
      </label>
      <label className="text-xs font-black uppercase tracking-wide">Correo
        <input name="email" type="email" required autoComplete="email" className={fieldClass} placeholder="directiva@junta.cl" />
      </label>
      <label className="text-xs font-black uppercase tracking-wide">Celular
        <input name="phone" type="tel" required autoComplete="tel" className={fieldClass} placeholder="+56 9 1234 5678" />
      </label>
      <label className="text-xs font-black uppercase tracking-wide sm:col-span-2">Nombre de la junta
        <input name="juntaName" required minLength={3} maxLength={160} className={fieldClass} placeholder="Junta de Vecinos Villa Esperanza" />
      </label>
      <label className="text-xs font-black uppercase tracking-wide">Región
        <select value={region} onChange={(event) => { const next = event.target.value; setRegion(next); setComuna(getCommunes(next)[0] ?? ''); }} className={fieldClass}>
          {CHILE_REGIONS.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="text-xs font-black uppercase tracking-wide">Comuna
        <select value={comuna} onChange={(event) => setComuna(event.target.value)} className={fieldClass}>
          {communes.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="text-xs font-black uppercase tracking-wide">Cantidad aproximada de vecinos
        <input name="memberCount" type="number" min={1} max={100000} inputMode="numeric" className={fieldClass} placeholder="150" />
      </label>
      <label className="text-xs font-black uppercase tracking-wide">Plan de interés
        <select value={plan} onChange={(event) => setPlan(event.target.value as PlanId)} className={fieldClass}>
          {Object.values(PLANS).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="text-xs font-black uppercase tracking-wide sm:col-span-2">¿Qué les gustaría ordenar primero? <span className="normal-case text-[#526071]">(opcional)</span>
        <textarea name="message" rows={3} maxLength={800} className={fieldClass} placeholder="Por ejemplo: padrón de socios, cuotas, avisos o consultas…" />
      </label>
    </div>

    <label className="mt-5 flex items-start gap-3 border-2 border-[#071b34] bg-[#fff4c2] p-3 text-xs font-bold leading-5">
      <input name="consent" type="checkbox" required className="trial-request-checkbox mt-1 h-4 w-4 accent-[#f97316]" />
      Autorizo a JuntAPP a contactarme respecto de esta solicitud de prueba y la creación de la junta.
    </label>
    <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}><label>Sitio web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    {error && <p role="alert" className="mt-4 border-2 border-[#071b34] bg-[#ffd2d2] p-3 text-sm font-black">{error}</p>}
    <button disabled={pending} className="trial-request-submit mt-5 w-full border-4 border-[#071b34] bg-[#f97316] px-5 py-4 text-sm font-black uppercase shadow-[4px_4px_0_#071b34] transition hover:-translate-y-0.5 disabled:opacity-60">
      {pending ? 'Enviando solicitud…' : 'Solicitar mi mes gratis →'}
    </button>
    <p className="mt-3 text-center text-xs font-semibold text-[#526071]">No pedimos tarjeta. El mes comienza cuando nuestro equipo activa tu junta.</p>
  </form>;
}
