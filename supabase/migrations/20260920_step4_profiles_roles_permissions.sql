-- ============================================================================
-- STEP 4: Profiles, Roles, and Permissions Schema
-- ============================================================================
-- Date: September 20, 2026
-- Purpose: Create comprehensive user profiles table with roles and permissions
--          Link auth.users to profiles, establish role hierarchy, and define
--          permissions for role-based access control (RBAC)
-- ============================================================================

-- ============================================================================
-- 1. ENHANCE PROFILES TABLE
-- ============================================================================
-- Add missing columns to existing profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS designation VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile VARCHAR(20);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PENDING', 'INACTIVE', 'SUSPENDED', 'LOCKED', 'REJECTED'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30) DEFAULT 'ADMIN_APPROVED' CHECK (approval_status IN ('ADMIN_APPROVED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS creation_method VARCHAR(30) DEFAULT 'ADMIN_CREATED' CHECK (creation_method IN ('ADMIN_CREATED', 'REGISTRATION_REQUEST'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_by VARCHAR(150);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS require_password_change BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 2. CREATE COMPREHENSIVE ROLES TABLE
-- ============================================================================
-- Stores role definitions with metadata (separate from app_role enum)
CREATE TABLE IF NOT EXISTS public.role_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code VARCHAR(50) NOT NULL UNIQUE,          -- 'admin', 'manager', 'operator', 'viewer'
  role_name VARCHAR(100) NOT NULL,                -- 'Administrator', 'Manager', etc.
  description TEXT,                                -- Role description
  display_order INT DEFAULT 0,                    -- For UI ordering
  is_system BOOLEAN DEFAULT TRUE,                 -- System roles cannot be deleted
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default system roles
INSERT INTO public.role_definitions (role_code, role_name, description, display_order, is_system)
VALUES
  ('admin', 'Administrator', 'Full system access, user management, configuration', 1, TRUE),
  ('manager', 'Manager', 'Department head, can approve/reject operations, view reports', 2, TRUE),
  ('operator', 'Operator', 'Day-to-day operations, can create and edit entries', 3, TRUE),
  ('viewer', 'Viewer', 'Read-only access to data', 4, TRUE)
ON CONFLICT (role_code) DO NOTHING;

-- ============================================================================
-- 3. CREATE PERMISSIONS TABLE
-- ============================================================================
-- Define granular permissions
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_code VARCHAR(100) NOT NULL UNIQUE,  -- 'yarn_master:read', 'yarn_master:write', etc.
  permission_name VARCHAR(150) NOT NULL,         -- 'Read Yarn Masters', 'Create Yarn Masters', etc.
  description TEXT,
  module VARCHAR(50) NOT NULL,                   -- 'yarn_master', 'inventory', 'production', etc.
  action VARCHAR(20) NOT NULL,                   -- 'read', 'create', 'update', 'delete', 'approve'
  is_system BOOLEAN DEFAULT TRUE,                -- System permissions
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert system permissions (sample)
INSERT INTO public.permissions (permission_code, permission_name, module, action, is_system)
VALUES
  ('yarn_master:read', 'Read Yarn Masters', 'yarn_master', 'read', TRUE),
  ('yarn_master:create', 'Create Yarn Masters', 'yarn_master', 'create', TRUE),
  ('yarn_master:update', 'Update Yarn Masters', 'yarn_master', 'update', TRUE),
  ('yarn_master:delete', 'Delete Yarn Masters', 'yarn_master', 'delete', TRUE),
  ('cost_sheet:read', 'Read Cost Sheets', 'cost_sheet', 'read', TRUE),
  ('cost_sheet:create', 'Create Cost Sheets', 'cost_sheet', 'create', TRUE),
  ('cost_sheet:update', 'Update Cost Sheets', 'cost_sheet', 'update', TRUE),
  ('cost_sheet:approve', 'Approve Cost Sheets', 'cost_sheet', 'approve', TRUE),
  ('inventory:read', 'Read Inventory', 'inventory', 'read', TRUE),
  ('inventory:write', 'Write Inventory Transactions', 'inventory', 'write', TRUE),
  ('production:read', 'Read Production Orders', 'production', 'read', TRUE),
  ('production:create', 'Create Production Orders', 'production', 'create', TRUE),
  ('production:update', 'Update Production Orders', 'production', 'update', TRUE),
  ('quality:read', 'Read Quality Inspections', 'quality', 'read', TRUE),
  ('quality:write', 'Write Quality Inspections', 'quality', 'write', TRUE),
  ('sales:read', 'Read Sales Orders', 'sales', 'read', TRUE),
  ('sales:create', 'Create Sales Orders', 'sales', 'create', TRUE),
  ('sales:update', 'Update Sales Orders', 'sales', 'update', TRUE),
  ('user_management:read', 'Read User Management', 'user_management', 'read', TRUE),
  ('user_management:write', 'Write User Management', 'user_management', 'write', TRUE),
  ('reports:read', 'Read Reports', 'reports', 'read', TRUE),
  ('audit:read', 'Read Audit Logs', 'audit', 'read', TRUE)
ON CONFLICT (permission_code) DO NOTHING;

-- ============================================================================
-- 4. CREATE ROLE-PERMISSION JUNCTION TABLE
-- ============================================================================
-- Map permissions to roles
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.role_definitions(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (role_id, permission_id)
);

-- Assign permissions to roles
-- Admin: All permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rd.id, p.id FROM public.role_definitions rd, public.permissions p
WHERE rd.role_code = 'admin' AND p.is_active = TRUE
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager: All read + create/update/approve, but not delete or user management
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rd.id, p.id FROM public.role_definitions rd, public.permissions p
WHERE rd.role_code = 'manager'
  AND p.is_active = TRUE
  AND p.action IN ('read', 'create', 'update', 'approve')
  AND p.module NOT IN ('user_management')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Operator: Read + create/update (no delete, no approve, no user mgmt, no audit)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rd.id, p.id FROM public.role_definitions rd, public.permissions p
WHERE rd.role_code = 'operator'
  AND p.is_active = TRUE
  AND p.action IN ('read', 'create', 'update', 'write')
  AND p.module NOT IN ('user_management', 'audit')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Viewer: Read-only access
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rd.id, p.id FROM public.role_definitions rd, public.permissions p
WHERE rd.role_code = 'viewer'
  AND p.is_active = TRUE
  AND p.action IN ('read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- 5. CREATE AUDIT LOG TABLE
-- ============================================================================
-- Track changes to user profiles
CREATE TABLE IF NOT EXISTS public.profile_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,                   -- 'created', 'updated', 'deleted', 'suspended', 'unlocked'
  changed_fields JSONB DEFAULT '{}'::jsonb,     -- {'status': {'from': 'ACTIVE', 'to': 'SUSPENDED'}}
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_email VARCHAR(255),
  change_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON public.profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON public.profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_definitions_code ON public.role_definitions(role_code);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON public.permissions(module);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON public.permissions(permission_code);

-- ============================================================================
-- 7. CREATE RLS POLICIES
-- ============================================================================

-- === Role Definitions RLS ===
ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_defs_select_all" ON public.role_definitions
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "role_defs_admin_write" ON public.role_definitions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- === Permissions RLS ===
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissions_select_all" ON public.permissions
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "permissions_admin_write" ON public.permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- === Role Permissions RLS ===
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_perms_select_all" ON public.role_permissions
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "role_perms_admin_write" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- === Profile Audit Log RLS ===
ALTER TABLE public.profile_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_admin" ON public.profile_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "audit_log_select_own" ON public.profile_audit_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.id = public.profile_audit_log.profile_id
  ));

CREATE POLICY "audit_log_admin_write" ON public.profile_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 8. UPDATE PROFILES POLICY (ADD RLS IF NOT EXISTS)
-- ============================================================================
-- Users can view their own profile + admin can view all
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()  -- Users see their own profile
    OR public.has_role(auth.uid(), 'admin')  -- Admin sees all
  );

-- Users can update their own profile
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin can update any profile
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 9. HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _permission_code varchar)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role = (
      SELECT role_code FROM public.role_definitions rd WHERE rd.id = rp.role_id
    )::public.app_role
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = _user_id
    AND p.permission_code = _permission_code
    AND p.is_active = TRUE
  )
$$;

-- Function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_primary_role(_user_id uuid)
RETURNS VARCHAR LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.role::text FROM public.user_roles p
  WHERE p.user_id = _user_id
  ORDER BY p.created_at DESC
  LIMIT 1
$$;

-- Function to audit profile changes
CREATE OR REPLACE FUNCTION public.audit_profile_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_changed_fields JSONB := '{}'::jsonb;
BEGIN
  -- Track changed fields
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_changed_fields = jsonb_set(v_changed_fields, '{status}', jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    v_changed_fields = jsonb_set(v_changed_fields, '{approval_status}', jsonb_build_object('from', OLD.approval_status, 'to', NEW.approval_status));
  END IF;
  IF NEW.is_locked IS DISTINCT FROM OLD.is_locked THEN
    v_changed_fields = jsonb_set(v_changed_fields, '{is_locked}', jsonb_build_object('from', OLD.is_locked, 'to', NEW.is_locked));
  END IF;

  -- Insert audit log if there were changes
  IF v_changed_fields != '{}'::jsonb THEN
    INSERT INTO public.profile_audit_log (
      profile_id, action, changed_fields, changed_by, changed_by_email, created_at
    ) VALUES (
      NEW.id, 'updated', v_changed_fields, auth.uid(), NEW.email, NOW()
    );
  END IF;

  RETURN NEW;
END; $$;

-- Create trigger for profile changes
DROP TRIGGER IF EXISTS trigger_audit_profile_change ON public.profiles;
CREATE TRIGGER trigger_audit_profile_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_profile_change();

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON public.role_definitions TO authenticated;
GRANT ALL ON public.role_definitions TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.profile_audit_log TO authenticated;
GRANT ALL ON public.profile_audit_log TO service_role;

-- ============================================================================
-- 11. VERIFICATION
-- ============================================================================
-- Verify tables exist and have correct structure
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('profiles', 'role_definitions', 'permissions', 'role_permissions', 'profile_audit_log');
