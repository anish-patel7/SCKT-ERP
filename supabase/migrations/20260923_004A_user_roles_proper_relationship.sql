-- ============================================================================
-- MIGRATION: Fix user_roles table to use role_definitions.id
-- Date: September 23, 2026
-- Purpose: Properly link users to role_definitions table using UUID foreign key
--          instead of relying on legacy app_role enum
-- ============================================================================

-- Step 1: Add primary_role_id column to profiles table to track current role
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_role_id UUID REFERENCES public.role_definitions(id) ON DELETE SET NULL;

-- Step 2: Create new user_roles_mapping table to replace the old user_roles with proper FK
CREATE TABLE IF NOT EXISTS public.user_roles_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.role_definitions(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_mapping_user_id ON public.user_roles_mapping(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_mapping_role_id ON public.user_roles_mapping(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_mapping_is_primary ON public.user_roles_mapping(is_primary);

-- Step 3: Migrate existing user_roles data if old table exists and has data
DO $$
DECLARE
  v_admin_role_id UUID;
  v_row RECORD;
BEGIN
  -- Get admin role ID for default assignment
  SELECT id INTO v_admin_role_id FROM public.role_definitions WHERE role_code = 'admin' LIMIT 1;

  -- If old user_roles table exists and has data, migrate it
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
    INSERT INTO public.user_roles_mapping (user_id, role_id, is_primary, is_active)
    SELECT DISTINCT
      ur.user_id,
      COALESCE(rd.id, v_admin_role_id),
      TRUE,
      TRUE
    FROM public.user_roles ur
    LEFT JOIN public.role_definitions rd ON rd.role_code = ur.role::text
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_roles_mapping urm
      WHERE urm.user_id = ur.user_id
      AND urm.role_id = COALESCE(rd.id, v_admin_role_id)
    )
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;
END $$;

-- Step 4: Create RLS policies for user_roles_mapping
ALTER TABLE public.user_roles_mapping ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all role assignments (needed for permission matrix UI)
DROP POLICY IF EXISTS "user_roles_select_all" ON public.user_roles_mapping;
CREATE POLICY "user_roles_select_all" ON public.user_roles_mapping
  FOR SELECT TO authenticated USING (TRUE);

-- Only admin can modify role assignments
DROP POLICY IF EXISTS "user_roles_admin_write" ON public.user_roles_mapping;
CREATE POLICY "user_roles_admin_write" ON public.user_roles_mapping
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Step 5: Grant permissions
GRANT SELECT ON public.user_roles_mapping TO authenticated;
GRANT ALL ON public.user_roles_mapping TO service_role;

-- Step 6: Create helper function to get user's effective permissions
CREATE OR REPLACE FUNCTION public.get_user_effective_permissions(_user_id uuid)
RETURNS TABLE(permission_id UUID, permission_code VARCHAR, module VARCHAR, action VARCHAR)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
  SELECT DISTINCT
    p.id,
    p.permission_code,
    p.module,
    p.action
  FROM public.user_roles_mapping urm
  JOIN public.role_permissions rp ON rp.role_id = urm.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE urm.user_id = _user_id
    AND urm.is_active = TRUE
    AND p.is_active = TRUE
  ORDER BY p.module, p.action
$$;

-- Step 7: Create helper function to check if user has specific permission
CREATE OR REPLACE FUNCTION public.user_has_permission_v2(_user_id uuid, _permission_code varchar)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.get_user_effective_permissions(_user_id)
    WHERE permission_code = _permission_code
  )
$$;

-- Step 8: Create helper function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_primary_role_id(_user_id uuid)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
  SELECT role_id FROM public.user_roles_mapping
  WHERE user_id = _user_id
    AND is_primary = TRUE
    AND is_active = TRUE
  LIMIT 1
$$;

-- Step 9: Verify schema integrity
-- SELECT COUNT(*) as total_role_assignments FROM public.user_roles_mapping;
-- SELECT COUNT(*) as total_roles FROM public.role_definitions WHERE is_active = TRUE;
-- SELECT COUNT(*) as total_permissions FROM public.permissions WHERE is_active = TRUE;
