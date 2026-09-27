import SeoDocument from '@/components/seo/SeoDocument';
import { requireSeoPage } from '@/content/seo/registry';
import { publicMetadata } from '@/lib/seo/metadata';

const page = requireSeoPage('/recursos');

export const metadata = publicMetadata({
  title: page.title,
  description: page.description,
  path: page.path,
});

export default function RecursosPage() {
  return <SeoDocument page={page} />;
}
