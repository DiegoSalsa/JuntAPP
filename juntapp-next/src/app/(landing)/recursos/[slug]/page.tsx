import { notFound } from 'next/navigation';
import SeoDocument from '@/components/seo/SeoDocument';
import { GUIDE_PAGES } from '@/content/seo/guides';
import { publicMetadata } from '@/lib/seo/metadata';

export function generateStaticParams() {
  return GUIDE_PAGES.map((page) => ({ slug: page.path.replace('/recursos/', '') }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = GUIDE_PAGES.find((item) => item.path === `/recursos/${slug}`);
  if (!page) return {};
  return publicMetadata({ title: page.title, description: page.description, path: page.path, type: 'article' });
}

export default async function ResourceGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = GUIDE_PAGES.find((item) => item.path === `/recursos/${slug}`);
  if (!page) notFound();
  return <SeoDocument page={page} />;
}
