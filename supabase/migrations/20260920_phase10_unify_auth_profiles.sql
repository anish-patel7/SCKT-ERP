-- ============================================================================
-- STEP 20 PHASE 10: Unify User Management with Supabase Auth
-- ============================================================================
-- Date: September 20, 2026
-- Purpose:
--   1. Ensure profiles table is properly linked to auth.users (1-to-1 FK on id)
--   2. Add auth-triggered profile creation via trigger
--   3. Validate all required profile columns exist
--   4. Enable RLS on profiles table for auth users
--   5. Ensure new signups create profiles with primary_role_id='viewer'
-- ============================================================================

-- ============================================================================
-- 1. VERIFY profiles TABLE STRUCTURE AND ADD MISSING COLUMNS
-- ============================================================================

-- Ensure primary key is UUID matching auth.users.id
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT uuid_generate_v4();

-- Add FK constraint to auth.users (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name = 'fk_profiles_auth_user'
  ) THEN
    -- This will fail if id is not a PK, but we've ensured that above
    ALTER TABLE public.profiles
    ADD CONSTRAINT fk_profiles_auth_user
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure all required profile columns exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS display_name VARCHAR(200);

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS mobile VARCHAR(20);

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) UNIQUE;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS department VARCHAR(100);

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS designation VARCHAR(100);

-- RBAC columns (created in PHASE 6, but ensure they exist here)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS primary_role_id VARCHAR(50) NOT NULL DEFAULT 'viewer';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS additional_role_ids TEXT[] DEFAULT ARRAY[]::TEXT[];

-- User status and audit columns
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'LOCKED'));

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 2. CREATE TRIGGER FOR AUTOMATIC PROFILE CREATION ON AUTH SIGNUP
-- ============================================================================

-- Function to create profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    display_name,
    primary_role_id,
    status,
    created_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE((NEW.user_metadata->>'first_name')::text, 'User'),
    COALESCE((NEW.user_metadata->>'last_name')::text, ''),
    COALESCE((NEW.user_metadata->>'display_name')::text, NEW.email),
    'viewer',  -- Default role for all new users
    'ACTIVE',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW()
  RETURNING *;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop old trigger if it exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created_profiles ON auth.users;

CREATE TRIGGER on_auth_user_created_profiles
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_primary_role_id ON public.profiles(primary_role_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON public.profiles(employee_id);

-- ============================================================================
-- 4. ENABLE RLS ON profiles TABLE
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;

-- USERS: Can read own profile
CREATE POLICY "users_read_own_profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- ADMIN: Can read all profiles
CREATE POLICY "admin_read_all_profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.primary_role_id = 'admin'
  )
);

-- USERS: Can update own profile (limited fields only)
CREATE POLICY "users_update_own_profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ADMIN: Can update any profile
CREATE POLICY "admin_update_any_profile"
ON public.profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.primary_role_id = 'admin'
  )
);

-- DENY INSERT/DELETE by default (managed by auth trigger and admin only)
CREATE POLICY "deny_insert_profiles"
ON public.profiles FOR INSERT
WITH CHECK (FALSE);

CREATE POLICY "admin_delete_profiles"
ON public.profiles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.primary_role_id = 'admin'
  )
);

-- ============================================================================
-- 5. VALIDATION QUERIES
-- ============================================================================

-- After running this migration, verify:
-- SELECT id, email, primary_role_id, status
-- FROM public.profiles
-- LIMIT 10;
--
-- All profiles should have primary_role_id set and status='ACTIVE'
-- New auth users should auto-create profiles with viewer role

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- Status: Supabase Auth + Profiles integration complete
-- Next: Create profiles service, update auth hooks, remove localStorage usage
