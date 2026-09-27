import type { MetadataRoute } from 'next';
import { SITEMAP_PATHS } from '@/content/seo/registry';
import { listIndexableCommunitySites } from '@/lib/seo/community-sites';
import { absoluteUrl, CONTENT_UPDATED } from '@/lib/seo/site';

export const dynamic = 'force-dynamic';

const updated = new Date(`${CONTENT_UPDATED}T12:00:00Z`);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = SITEMAP_PATHS.map((item) => ({
    url: absoluteUrl(item.path),
    lastModified: updated,
    changeFrequency: item.path === '/' ? 'weekly' : 'monthly',
    priority: item.priority,
  }));
  const communities = await listIndexableCommunitySites();
  const dynamicEntries: MetadataRoute.Sitemap = communities.map((site) => ({
    url: absoluteUrl(site.path),
    lastModified: site.lastModified ?? updated,
    changeFrequency: 'monthly',
    priority: 0.3,
  }));
  return [...staticEntries, ...dynamicEntries];
}
