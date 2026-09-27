import type { Metadata } from 'next';
import { absoluteUrl, OG_IMAGE_PATH, SITE_LOCALE, SITE_NAME } from '@/lib/seo/site';

type PublicMetadataInput = {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
  index?: boolean;
  follow?: boolean;
  type?: 'website' | 'article';
};

export function publicMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  index = true,
  follow = true,
  type = 'website',
}: PublicMetadataInput): Metadata {
  const canonical = path.startsWith('/') ? path : `/${path}`;
  const image = absoluteUrl(OG_IMAGE_PATH);
  const fullTitle = absoluteTitle || title.includes('| JuntAPP') ? title : `${title} | JuntAPP`;

  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical },
    robots: { index, follow },
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type,
      images: [{ url: image, alt: 'JuntAPP' }],
    },
    twitter: {
      card: 'summary',
      title: fullTitle,
      description,
      images: [image],
    },
  };
}

export const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: false };
