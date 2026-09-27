import OriginalPublicPage from '@/components/original/OriginalPublicPage';
import { publicMetadata } from '@/lib/seo/metadata';

export const metadata = publicMetadata({
  title: 'Términos y privacidad',
  description: 'Términos, condiciones y privacidad de JuntAPP, incluido el tratamiento de datos personales según la Ley 19.628.',
  path: '/legal',
});

export default function LegalPage() {
  return <OriginalPublicPage view="legal" />;
}
