-- ============================================================================
-- MIGRATION 005A: Single RBAC authority + profiles policy repair
-- Date: 2026-09-24
--
-- Fixes:
--   1. RBAC write policies depended on has_role(), which read the legacy
--      user_roles table (dropped by phase6 in some histories). Admins could
--      not reliably save roles, permissions or assignments; authenticated also
--      lacked DELETE on role_permissions and any write on user_roles_mapping.
--   2. users_update_own_profile let any user set their own primary_role_id
--      (e.g. to 'admin'), which the RLS policies trust.
--   3. Admin policies on profiles queried profiles from inside a profiles
--      policy -> "infinite recursion detected in policy for relation profiles".
--   4. step4/004A used CREATE POLICY IF NOT EXISTS (invalid syntax), so the
--      RBAC tables/functions they define may not exist. They are (re)created
--      here idempotently.
--
-- Authority model (matches the frontend accessService):
--   * user_roles_mapping is authoritative: a user with any active assignment
--     holds exactly those active roles.
--   * profiles.primary_role_id is a fallback base role only for users with no
--     assignment.
--   * The 'admin' role holds every permission. A profile whose status is set
--     and not 'ACTIVE' holds nothing.
--
-- Safe to run on any prior state and to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. RBAC tables (as defined by step4 / 004A)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code VARCHAR(50) NOT NULL UNIQUE,
  role_name VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0,
  is_system BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_code VARCHAR(100) NOT NULL UNIQUE,
  permission_name VARCHAR(150) NOT NULL,
  description TEXT,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL,
  is_system BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.role_definitions(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (role_id, permission_id)
);

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
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);

-- profiles columns the authority model reads (no-ops where they already exist).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_role_id VARCHAR(50) DEFAULT 'viewer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';

-- ----------------------------------------------------------------------------
-- B. Seed data (only fills gaps; never re-grants what an admin revoked)
-- ----------------------------------------------------------------------------
INSERT INTO public.role_definitions (role_code, role_name, description, display_order, is_system)
VALUES
  ('admin', 'Administrator', 'Full system access, user management, configuration', 1, TRUE),
  ('manager', 'Manager', 'Department head, can approve/reject operations, view reports', 2, TRUE),
  ('operator', 'Operator', 'Day-to-day operations, can create and edit entries', 3, TRUE),
  ('viewer', 'Viewer', 'Read-only access to data', 4, TRUE)
ON CONFLICT (role_code) DO NOTHING;

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
  ('audit:read', 'Read Audit Logs', 'audit', 'read', TRUE),
  ('masters.yarn:read', 'Read Yarn Masters', 'masters.yarn', 'read', TRUE),
  ('masters.yarn:create', 'Create Yarn Masters', 'masters.yarn', 'create', TRUE),
  ('masters.yarn:update', 'Update Yarn Masters', 'masters.yarn', 'update', TRUE),
  ('masters.yarn:delete', 'Delete Yarn Masters', 'masters.yarn', 'delete', TRUE),
  ('masters.generic:read', 'Read Generic Masters', 'masters.generic', 'read', TRUE),
  ('masters.generic:create', 'Create Generic Masters', 'masters.generic', 'create', TRUE),
  ('masters.generic:update', 'Update Generic Masters', 'masters.generic', 'update', TRUE),
  ('masters.generic:delete', 'Delete Generic Masters', 'masters.generic', 'delete', TRUE),
  ('masters.party:read', 'Read Parties', 'masters.party', 'read', TRUE),
  ('masters.party:create', 'Create Parties', 'masters.party', 'create', TRUE),
  ('masters.party:update', 'Update Parties', 'masters.party', 'update', TRUE),
  ('masters.party:delete', 'Delete Parties', 'masters.party', 'delete', TRUE),
  ('design:read', 'Read Designs', 'design', 'read', TRUE),
  ('design:create', 'Create Designs', 'design', 'create', TRUE),
  ('design:update', 'Update Designs', 'design', 'update', TRUE),
  ('design:delete', 'Delete Designs', 'design', 'delete', TRUE)
ON CONFLICT (permission_code) DO NOTHING;

-- Default grants (step4 rules) only for system roles that currently have none.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rd.id, p.id
FROM public.role_definitions rd
JOIN public.permissions p ON p.is_active IS DISTINCT FROM FALSE
WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions x WHERE x.role_id = rd.id)
  AND (
    rd.role_code = 'admin'
    OR (rd.role_code = 'manager' AND p.action IN ('read', 'create', 'update', 'approve')
        AND p.module <> 'user_management')
    OR (rd.role_code = 'operator' AND p.action IN ('read', 'create', 'update', 'write')
        AND p.module NOT IN ('user_management', 'audit'))
    OR (rd.role_code = 'viewer' AND p.action = 'read')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Preserve explicit roles from the legacy user_roles table, if it still exists,
-- for users that have no assignment yet.
DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    INSERT INTO public.user_roles_mapping (user_id, role_id, is_primary, is_active)
    SELECT ur.user_id, rd.id, FALSE, TRUE
    FROM public.user_roles ur
    JOIN public.role_definitions rd ON rd.role_code = ur.role::text
    WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ur.user_id)
      AND NOT EXISTS (SELECT 1 FROM public.user_roles_mapping m WHERE m.user_id = ur.user_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- C. Canonical resolver + helpers
--    SECURITY DEFINER so they read profiles/assignments without RLS (this is
--    what removes the recursive profiles policies). Owner must not be subject
--    to RLS on these tables (default for the migration role).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rbac_user_role_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH profile AS (
    SELECT p.primary_role_id, p.status FROM public.profiles p WHERE p.id = _user_id
  ),
  blocked AS (
    SELECT EXISTS (
      SELECT 1 FROM profile WHERE status IS NOT NULL AND status <> 'ACTIVE'
    ) AS is_blocked
  ),
  explicit AS (
    SELECT m.role_id
    FROM public.user_roles_mapping m
    JOIN public.role_definitions rd ON rd.id = m.role_id
    WHERE m.user_id = _user_id
      AND m.is_active IS DISTINCT FROM FALSE
      AND rd.is_active IS DISTINCT FROM FALSE
  ),
  has_assignment AS (
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles_mapping m
      WHERE m.user_id = _user_id AND m.is_active IS DISTINCT FROM FALSE
    ) AS any_row
  )
  SELECT role_id FROM explicit, blocked WHERE NOT blocked.is_blocked
  UNION
  SELECT rd.id
  FROM profile
  JOIN public.role_definitions rd ON rd.role_code = lower(trim(profile.primary_role_id))
  CROSS JOIN blocked
  CROSS JOIN has_assignment
  WHERE NOT blocked.is_blocked
    AND NOT has_assignment.any_row
    AND rd.is_active IS DISTINCT FROM FALSE
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rbac_user_role_ids(_user_id) r(role_id)
    JOIN public.role_definitions rd ON rd.id = r.role_id
    WHERE rd.role_code = 'admin'
  );
$$;

-- Same signature as step4/step9, so every existing RLS policy that calls it keeps working.
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _permission_code varchar)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.rbac_user_role_ids(_user_id) r(role_id)
      JOIN public.role_permissions rp ON rp.role_id = r.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE p.permission_code = _permission_code
        AND p.is_active IS DISTINCT FROM FALSE
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission_v2(_user_id uuid, _permission_code varchar)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_permission(_user_id, _permission_code);
$$;

DROP FUNCTION IF EXISTS public.get_user_effective_permissions(uuid);
CREATE FUNCTION public.get_user_effective_permissions(_user_id uuid)
RETURNS TABLE(permission_id UUID, permission_code VARCHAR, module VARCHAR, action VARCHAR)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.id, p.permission_code, p.module, p.action
  FROM public.permissions p
  WHERE p.is_active IS DISTINCT FROM FALSE
    AND (
      public.is_admin(_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.rbac_user_role_ids(_user_id) r(role_id)
        JOIN public.role_permissions rp ON rp.role_id = r.role_id
        WHERE rp.permission_id = p.id
      )
    )
  ORDER BY p.module, p.action;
$$;

CREATE OR REPLACE FUNCTION public.get_user_primary_role_id(_user_id uuid)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT m.role_id
       FROM public.user_roles_mapping m
       JOIN public.rbac_user_role_ids(_user_id) r(role_id) ON r.role_id = m.role_id
      WHERE m.user_id = _user_id AND m.is_primary
      LIMIT 1),
    (SELECT r.role_id FROM public.rbac_user_role_ids(_user_id) r(role_id) LIMIT 1)
  );
$$;

DROP FUNCTION IF EXISTS public.get_user_role(uuid);
CREATE FUNCTION public.get_user_role(_user_id uuid)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rd.role_code::text
  FROM public.role_definitions rd
  WHERE rd.id = public.get_user_primary_role_id(_user_id);
$$;

-- has_role(): keep whichever signature the database already uses (policies may
-- depend on it), but resolve it through the canonical role set. Plain string
-- literals (no nested dollar quotes) so web SQL editors split this correctly.
DO $$
DECLARE
  body text := 'SELECT EXISTS (SELECT 1 FROM public.rbac_user_role_ids(_user_id) r(role_id) '
    || 'JOIN public.role_definitions rd ON rd.id = r.role_id WHERE rd.role_code = _role::text)';
  role_type text := CASE
    WHEN to_regtype('public.app_role') IS NOT NULL THEN 'public.app_role'
    ELSE 'text'
  END;
BEGIN
  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role %s) '
      || 'RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS %L',
    role_type,
    body
  );
END $$;

REVOKE ALL ON FUNCTION public.rbac_user_role_ids(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_has_permission(uuid, varchar) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_has_permission_v2(uuid, varchar) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_effective_permissions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_primary_role_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rbac_user_role_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_permission(uuid, varchar) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_permission_v2(uuid, varchar) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_effective_permissions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_primary_role_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- D. RBAC table policies and grants
--    Read: any authenticated user (needed to resolve access in the UI).
--    Write: holders of user_management:write (administrators always qualify).
--    The permission catalog itself is managed by migrations only.
-- ----------------------------------------------------------------------------
ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles_mapping ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY['role_definitions', 'permissions', 'role_permissions', 'user_roles_mapping']
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "role_defs_select_all" ON public.role_definitions
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "role_defs_manage" ON public.role_definitions
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission(auth.uid(), 'user_management:write'));
CREATE POLICY "role_defs_update" ON public.role_definitions
  FOR UPDATE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'user_management:write'))
  WITH CHECK (
    public.user_has_permission(auth.uid(), 'user_management:write')
    -- the Administrator role can never be deactivated
    AND NOT (role_code = 'admin' AND is_active IS FALSE)
  );

CREATE POLICY "permissions_select_all" ON public.permissions
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "role_perms_select_all" ON public.role_permissions
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "role_perms_insert" ON public.role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission(auth.uid(), 'user_management:write'));
CREATE POLICY "role_perms_update" ON public.role_permissions
  FOR UPDATE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'user_management:write'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'user_management:write'));
CREATE POLICY "role_perms_delete" ON public.role_permissions
  FOR DELETE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'user_management:write'));

CREATE POLICY "user_roles_select_all" ON public.user_roles_mapping
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "user_roles_insert" ON public.user_roles_mapping
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission(auth.uid(), 'user_management:write'));
CREATE POLICY "user_roles_update" ON public.user_roles_mapping
  FOR UPDATE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'user_management:write'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'user_management:write'));
CREATE POLICY "user_roles_delete" ON public.user_roles_mapping
  FOR DELETE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'user_management:write'));

REVOKE ALL ON public.role_definitions, public.permissions, public.role_permissions,
  public.user_roles_mapping FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.permissions FROM authenticated;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.role_definitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles_mapping TO authenticated;
GRANT ALL ON public.role_definitions, public.permissions, public.role_permissions,
  public.user_roles_mapping TO service_role;

-- ----------------------------------------------------------------------------
-- E. profiles policies (replaces every existing one: removes the recursive
--    admin policies and the unrestricted self-update)
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.user_has_permission(auth.uid(), 'user_management:read')
  );

-- Own row: allowed, but privileged columns are guarded by the trigger below.
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_managed" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'user_management:write'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'user_management:write'));

CREATE POLICY "profiles_delete_managed" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'user_management:write'));

-- No INSERT policy: profiles are created by the SECURITY DEFINER signup trigger.

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- auth.uid() is NULL for service-role / SQL editor / internal triggers.
  IF auth.uid() IS NULL OR public.user_has_permission(auth.uid(), 'user_management:write') THEN
    RETURN NEW;
  END IF;

  IF NEW.primary_role_id IS DISTINCT FROM OLD.primary_role_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR (to_jsonb(NEW) -> 'approval_status') IS DISTINCT FROM (to_jsonb(OLD) -> 'approval_status')
     OR (to_jsonb(NEW) -> 'approved_by') IS DISTINCT FROM (to_jsonb(OLD) -> 'approved_by')
     OR (to_jsonb(NEW) -> 'approved_at') IS DISTINCT FROM (to_jsonb(OLD) -> 'approved_at')
     OR (to_jsonb(NEW) -> 'is_locked') IS DISTINCT FROM (to_jsonb(OLD) -> 'is_locked')
     OR (to_jsonb(NEW) -> 'additional_role_ids') IS DISTINCT FROM (to_jsonb(OLD) -> 'additional_role_ids')
     OR (to_jsonb(NEW) -> 'creation_method') IS DISTINCT FROM (to_jsonb(OLD) -> 'creation_method')
  THEN
    RAISE EXCEPTION 'Not allowed to change role, status or approval fields of a profile'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Rollback (manual): drop trg_guard_profile_privileged_columns and
-- guard_profile_privileged_columns(); re-create the previous profiles policies
-- from phase10; restore has_role/user_has_permission from step9. Not automated
-- because the previous definitions were themselves broken (see header).
