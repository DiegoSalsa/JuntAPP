import OriginalPublicPage from '@/components/original/OriginalPublicPage';
import { publicMetadata } from '@/lib/seo/metadata';

export const metadata = publicMetadata({
  title: 'Preguntas frecuentes',
  description: 'Respuestas sobre JuntAPP: planes, padrón de socios, tesorería, consultas y el uso de la plataforma en una junta de vecinos.',
  path: '/faq',
});

export default function FAQPage() {
  return <OriginalPublicPage view="faq" />;
}
