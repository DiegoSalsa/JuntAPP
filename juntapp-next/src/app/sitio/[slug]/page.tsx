import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import WebsiteRenderer from '@/components/website/WebsiteRenderer';
import { assessCommunityIndexability } from '@/lib/seo/community-indexability';
import { publicMetadata } from '@/lib/seo/metadata';
import { COMMUNITY_SITE_INDEXING_ENABLED } from '@/lib/seo/site';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_CONTENT, DEFAULT_THEME, type WebsiteContent, type WebsiteTemplate, type WebsiteTheme } from '@/lib/website';

type PublicWebsite = {
  name: string;
  template: WebsiteTemplate;
  content: Partial<WebsiteContent> | null;
  theme: Partial<WebsiteTheme> | null;
  logo_url?: string | null;
  hero_image_url?: string | null;
  gallery?: string[] | null;
};

const loadPublicWebsite = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_public_website', { p_slug: slug });
  return (data ?? null) as PublicWebsite | null;
});

function summary(about: string) {
  const clean = about.replace(/\s+/g, ' ').trim();
  return clean.length > 160 ? `${clean.slice(0, 157).trim()}…` : clean;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPublicWebsite(slug);
  if (!page) return { robots: { index: false, follow: false } };
  const content = { ...DEFAULT_CONTENT, ...(page.content ?? {}) };
  const decision = assessCommunityIndexability({ name: page.name, content });
  const path = `/sitio/${slug}`;
  const indexable = COMMUNITY_SITE_INDEXING_ENABLED && decision.indexable;
  return publicMetadata({
    title: page.name,
    description: indexable ? summary(content.about) : `Página de ${page.name}, publicada con JuntAPP.`,
    path,
    absoluteTitle: true,
    index: indexable,
    follow: true,
  });
}

export default async function PublicCommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await loadPublicWebsite(slug);
  if (!page) notFound();
  const content = { ...DEFAULT_CONTENT, ...(page.content ?? {}) };
  return (
    <WebsiteRenderer
      name={page.name}
      template={page.template}
      content={content}
      theme={{ ...DEFAULT_THEME, ...(page.theme ?? {}) }}
      logo={page.logo_url}
      hero={page.hero_image_url}
      gallery={page.gallery ?? []}
    />
  );
}
