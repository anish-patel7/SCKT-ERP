-- ============================================================================
-- MIGRATION 007A: New users get an explicit role assignment at signup
-- Date: 2026-09-26
--
-- Problem: handle_new_user() (005B) only creates public.profiles, whose
-- primary_role_id defaults to 'viewer'. New users therefore have no row in
-- public.user_roles_mapping and get access only through the profile
-- fallback, so Users & Roles shows them as "profile fallback" until an
-- admin assigns a role explicitly.
--
-- Fix:
--   * handle_new_user() now also inserts a primary user_roles_mapping row for
--     the profile's base role (default 'viewer'), only when the user has no
--     role assignment yet. That step has its own exception block, so a failure
--     there never blocks signup or rolls back the profile.
--   * One-time backfill: existing users with no role assignment get an
--     explicit primary row for their current profile base role, so their
--     access does not change.
-- Trigger on_auth_user_created is unchanged. Safe to re-run.
--
-- Rollback: re-run the CREATE OR REPLACE FUNCTION from
-- 20260924_005B_fix_signup_profile_trigger.sql (mappings created here can
-- stay; they match each user's existing base role).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

  -- Explicit primary role assignment for the profile's base role (default 'viewer').
  BEGIN
    INSERT INTO public.user_roles_mapping (user_id, role_id, is_primary, is_active)
    SELECT NEW.id, rd.id, TRUE, TRUE
    FROM public.profiles p
    JOIN public.role_definitions rd
      ON rd.role_code = lower(trim(p.primary_role_id))
     AND rd.is_active IS DISTINCT FROM FALSE
    WHERE p.id = NEW.id
      AND NOT EXISTS (SELECT 1 FROM public.user_roles_mapping m WHERE m.user_id = NEW.id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- The profile fallback still grants the base role; an admin can assign it later.
    RAISE WARNING 'handle_new_user: role assignment not created for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block account creation; the app reports a missing profile to the user.
  RAISE WARNING 'handle_new_user: profile not created for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Backfill: users with no role assignment get their current base role explicitly.
INSERT INTO public.user_roles_mapping (user_id, role_id, is_primary, is_active)
SELECT p.id, rd.id, TRUE, TRUE
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
JOIN public.role_definitions rd
  ON rd.role_code = lower(trim(p.primary_role_id))
 AND rd.is_active IS DISTINCT FROM FALSE
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles_mapping m WHERE m.user_id = p.id)
ON CONFLICT (user_id, role_id) DO NOTHING;
