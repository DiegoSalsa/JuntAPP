import { createClient } from '@supabase/supabase-js';
import { assessCommunityIndexability } from '@/lib/seo/community-indexability';
import type { WebsiteContent } from '@/lib/website';

type ListedWebsite = {
  slug: string;
  name: string;
  content: Partial<WebsiteContent> | null;
  updated_at: string | null;
};

export async function listIndexableCommunitySites() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  try {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.rpc('list_public_websites');
    if (error || !Array.isArray(data)) return [];

    return (data as ListedWebsite[]).flatMap((site) => {
      const slug = typeof site.slug === 'string' ? site.slug.trim() : '';
      if (!slug) return [];
      const decision = assessCommunityIndexability({ name: site.name, content: site.content });
      if (!decision.indexable) return [];
      const updated = site.updated_at ? new Date(site.updated_at) : undefined;
      return [{
        path: `/sitio/${encodeURIComponent(slug)}`,
        lastModified: updated && !Number.isNaN(updated.getTime()) ? updated : undefined,
      }];
    });
  } catch {
    return [];
  }
}
