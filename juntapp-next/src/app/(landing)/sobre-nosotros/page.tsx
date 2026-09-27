import OriginalPublicPage from '@/components/original/OriginalPublicPage';
import { publicMetadata } from '@/lib/seo/metadata';

export const metadata = publicMetadata({
  title: 'Sobre JuntAPP',
  description: 'JuntAPP es un software desarrollado en Chile por PuroCode para que una directiva administre su junta de vecinos.',
  path: '/sobre-nosotros',
});

export default function SobreNosotrosPage() {
  return <OriginalPublicPage view="sobreNosotros" />;
}
