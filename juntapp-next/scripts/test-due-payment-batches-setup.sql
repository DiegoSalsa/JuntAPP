CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;

-- The disposable database must exercise the same database roles as Supabase.
-- A superuser connection alone is not a valid authorization test because it
-- bypasses RLS and function privileges.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA public, auth, storage, extensions TO anon, authenticated, service_role;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION extensions.uuid_generate_v4()
RETURNS uuid LANGUAGE sql VOLATILE AS $$ SELECT public.uuid_generate_v4(); $$;
CREATE OR REPLACE FUNCTION extensions.pgp_sym_encrypt(value text, key text, options text)
RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT public.pgp_sym_encrypt(value, key, options); $$;
CREATE OR REPLACE FUNCTION extensions.pgp_sym_decrypt(value bytea, key text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT public.pgp_sym_decrypt(value, key); $$;
CREATE OR REPLACE FUNCTION extensions.crypt(value text, salt text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT public.crypt(value, salt); $$;
CREATE OR REPLACE FUNCTION extensions.gen_salt(kind text)
RETURNS text LANGUAGE sql VOLATILE AS $$ SELECT public.gen_salt(kind); $$;
CREATE OR REPLACE FUNCTION extensions.gen_random_bytes(size integer)
RETURNS bytea LANGUAGE sql VOLATILE AS $$ SELECT public.gen_random_bytes(size); $$;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  instance_id uuid,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token text,
  confirmation_sent_at timestamptz,
  recovery_token text,
  recovery_sent_at timestamptz,
  email_change_token_new text,
  email_change text,
  email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamptz,
  updated_at timestamptz,
  phone text,
  phone_confirmed_at timestamptz,
  phone_change text,
  phone_change_token text,
  phone_change_sent_at timestamptz,
  confirmed_at timestamptz,
  banned_until timestamptz,
  reauthentication_token text,
  reauthentication_sent_at timestamptz,
  is_sso_user boolean DEFAULT false,
  deleted_at timestamptz,
  is_anonymous boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS auth.identities (
  id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id text,
  identity_data jsonb,
  provider text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  owner uuid,
  public boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz,
  metadata jsonb,
  version text
);
CREATE OR REPLACE FUNCTION storage.foldername(value text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(value, '/'); $$;
