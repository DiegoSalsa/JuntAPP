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
