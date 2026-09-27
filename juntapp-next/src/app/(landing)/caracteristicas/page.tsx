import OriginalPublicPage from '@/components/original/OriginalPublicPage';
import { publicMetadata } from '@/lib/seo/metadata';

export const metadata = publicMetadata({
  title: 'Características',
  description: 'Funciones de JuntAPP para el padrón de socios, la tesorería, las consultas y los avisos de una junta de vecinos.',
  path: '/caracteristicas',
});

export default function CaracteristicasPage() {
  return <OriginalPublicPage view="caracteristicas" />;
}
