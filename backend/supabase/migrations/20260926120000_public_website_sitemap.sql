-- NO EJECUTAR EN PRODUCCIÓN EN EL PRIMER LANZAMIENTO SEO.
-- La política de indexabilidad de /sitio/[slug] queda preparada aquí,
-- pero COMMUNITY_SITE_INDEXING_ENABLED está en false y el sitemap
-- no llama esta función mientras siga apagada. Todas las páginas
-- /sitio/[slug] responden noindex hasta una activación explícita.
--
-- Lists published community sites so the sitemap can apply the
-- indexability policy. It does not expose member data. The Next.js
-- sitemap still drops thin or template pages.

CREATE OR REPLACE FUNCTION public.list_public_websites()
RETURNS TABLE (slug text, name text, content jsonb, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT j.slug, j.name, w.content, w.updated_at
  FROM public.juntas j
  JOIN public.website_pages w ON w.junta_id = j.id
  WHERE w.published = true
    AND j.subscription_status = 'authorized'
    AND (
      j.billing_mode <> 'trial_then_subscription'
      OR j.trial_ends_at > timezone('utc', now())
    );
$$;

REVOKE ALL ON FUNCTION public.list_public_websites() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_websites() TO anon, authenticated;
