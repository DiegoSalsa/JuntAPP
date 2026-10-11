-- Keep editor drafts separate from the snapshot served by get_public_website.
-- Existing rows continue to use their current published columns until the
-- first draft save or explicit publication.
ALTER TABLE public.website_pages
  ADD COLUMN IF NOT EXISTS draft_template TEXT,
  ADD COLUMN IF NOT EXISTS draft_content JSONB,
  ADD COLUMN IF NOT EXISTS draft_theme JSONB,
  ADD COLUMN IF NOT EXISTS draft_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS draft_hero_image_url TEXT,
  ADD COLUMN IF NOT EXISTS draft_gallery JSONB;

ALTER TABLE public.website_pages
  DROP CONSTRAINT IF EXISTS website_pages_draft_template_check;
ALTER TABLE public.website_pages
  ADD CONSTRAINT website_pages_draft_template_check CHECK (
    draft_template IS NULL OR draft_template IN (
      'comunidad', 'mural', 'institucional', 'noticias', 'minimalista',
      'editorial', 'fotografica', 'barrio', 'agenda', 'clasica', 'portal'
    )
  );

-- Public rendering already uses get_public_website, which only returns the
-- published snapshot. A table-level public SELECT would expose draft columns.
DROP POLICY IF EXISTS "Published websites are public" ON public.website_pages;
REVOKE SELECT ON public.website_pages FROM anon;
-- The existing "Owners manage their website" policy retains draft access for
-- active dirigentes of the owning junta, and protects every write.
