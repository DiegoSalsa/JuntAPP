import type { Metadata } from 'next';
import Image from 'next/image';
import OriginalPublicPage from '@/components/original/OriginalPublicPage';
import TrialRequestForm from '@/components/landing/TrialRequestForm';
import { isPlanId } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Solicitar prueba gratis — JuntAPP',
  description: 'Solicita un mes gratis de JuntAPP. Nuestro equipo crea el espacio de tu junta de forma personalizada y sin pedir tarjeta.',
};

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function TrialRequestPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const rawPlan = first(query.plan);
  const initialPlan = isPlanId(rawPlan) ? rawPlan : 'juntapp';

  return <OriginalPublicPage>
    <main className="bg-[#f3ecdf] px-4 py-12 text-[#071b34] sm:py-16">
      <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[.9fr_1.1fr]">
        <section className="lg:sticky lg:top-24">
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#f15a24]">1 mes gratis · sin tarjeta</p>
          <h1 className="mt-3 max-w-xl text-4xl font-black leading-[.98] tracking-[-.04em] sm:text-6xl">Probemos JuntAPP con tu propia junta.</h1>
          <p className="mt-5 max-w-lg text-lg font-semibold leading-8 text-[#526071]">La solicitud llega directamente a nuestro panel. Revisamos los antecedentes, creamos el espacio y enviamos un acceso personalizado a Presidencia.</p>
          <div className="mt-7 overflow-hidden border-4 border-[#071b34] bg-white shadow-[6px_6px_0_#071b34]">
            <Image src="/marketing/email/participacion-juntapp.jpg" width={1200} height={900} alt="Una vecina participando con JuntAPP" className="h-auto w-full" priority />
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs font-black uppercase">
            <span className="border-2 border-[#071b34] bg-white p-3">Solicitud</span><span className="border-2 border-[#071b34] bg-[#fff4c2] p-3">Creación</span><span className="border-2 border-[#071b34] bg-[#c9f7d4] p-3">1 mes de uso</span>
          </div>
        </section>
        <TrialRequestForm initialPlan={initialPlan} tracking={{
          utmSource: first(query.utm_source), utmMedium: first(query.utm_medium),
          utmCampaign: first(query.utm_campaign), utmContent: first(query.utm_content),
        }} />
      </div>
    </main>
  </OriginalPublicPage>;
}
