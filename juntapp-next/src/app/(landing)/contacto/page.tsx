import OriginalPublicPage from '@/components/original/OriginalPublicPage';
import { publicMetadata } from '@/lib/seo/metadata';

export const metadata = publicMetadata({
  title: 'Contacto',
  description: 'Escríbenos para digitalizar la gestión de tu junta de vecinos. El correo de JuntAPP es contacto@juntapp.cl.',
  path: '/contacto',
});

export default function ContactoPage() {
  return <OriginalPublicPage view="contacto" />;
}
