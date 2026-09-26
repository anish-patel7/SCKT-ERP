-- ============================================================================
-- MIGRATION 005B: One correct signup trigger for profiles
-- Date: 2026-09-24
--
-- Problem: depending on migration history, auth.users could carry up to three
-- AFTER INSERT triggers that write public.profiles:
--   * on_auth_user_created          -> handle_new_user()  (original version also
--                                      inserted into the legacy user_roles table)
--   * on_auth_user_created_profiles -> handle_new_user()  (phase10 version read
--                                      NEW.user_metadata, which does not exist on
--                                      auth.users; the column is raw_user_meta_data)
--   * on_auth_user_created_rbac     -> handle_new_user_rbac() (duplicate insert)
-- Any of them raising aborts the signup ("Database error saving new user").
--
-- Fix: a single trigger calling a corrected handle_new_user() that
--   * reads raw_user_meta_data,
--   * leaves primary_role_id/status to their column defaults (viewer / ACTIVE),
--   * fills optional name columns only when they exist,
--   * never aborts the signup (logs a WARNING instead),
-- plus a backfill of profiles for existing users that have none.
-- Safe to re-run.
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profiles ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_rbac ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  display text := COALESCE(
    NULLIF(meta ->> 'full_name', ''),
    NULLIF(meta ->> 'display_name', ''),
    NULLIF(trim(concat_ws(' ', meta ->> 'first_name', meta ->> 'last_name')), ''),
    NEW.email
  );
  col text;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, display)
  ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(public.profiles.email, EXCLUDED.email),
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  -- Optional name columns added by later migrations.
  FOREACH col IN ARRAY ARRAY['first_name', 'last_name', 'display_name']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = col
    ) AND meta ? col THEN
      EXECUTE format(
        'UPDATE public.profiles SET %I = COALESCE(%I, $1) WHERE id = $2',
        col,
        col
      ) USING meta ->> col, NEW.id;
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block account creation; the app reports a missing profile to the user.
  RAISE WARNING 'handle_new_user: profile not created for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: every existing auth user gets a profile (defaults: viewer / ACTIVE).
INSERT INTO public.profiles (id, email, full_name)
SELECT
  u.id,
  u.email,
  COALESCE(NULLIF(u.raw_user_meta_data ->> 'full_name', ''), u.email)
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
