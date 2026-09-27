import PricingPlans from '@/components/landing/PricingPlans';
import OriginalPublicPage from '@/components/original/OriginalPublicPage';
import { publicMetadata } from '@/lib/seo/metadata';

export const metadata = publicMetadata({
  title: 'Planes y precios',
  description: 'Planes de JuntAPP en pesos chilenos, con IVA: gestión de la junta, gestión con página pública o solo el sitio de la comunidad.',
  path: '/pricing',
});

export default function PricingPage() {
  return <OriginalPublicPage><PricingPlans /></OriginalPublicPage>;
}
