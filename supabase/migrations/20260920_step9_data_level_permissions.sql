-- ============================================================================
-- STEP 9: Data-Level Permission Enforcement
-- ============================================================================
-- Date: September 20, 2026
-- Purpose: Implement PostgreSQL RLS as authoritative security boundary
--          Add ownership tracking, enhance permission functions,
--          apply role-based RLS to all business tables
-- ============================================================================

-- ============================================================================
-- 1. ADD OWNERSHIP COLUMNS TO BUSINESS TABLES
-- ============================================================================

-- Materials table
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Masters table
ALTER TABLE public.masters ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.masters ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Parties table
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Designs table
ALTER TABLE public.designs ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.designs ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create indexes on ownership columns for performance
CREATE INDEX IF NOT EXISTS idx_materials_created_by ON public.materials(created_by);
CREATE INDEX IF NOT EXISTS idx_materials_updated_by ON public.materials(updated_by);
CREATE INDEX IF NOT EXISTS idx_masters_created_by ON public.masters(created_by);
CREATE INDEX IF NOT EXISTS idx_masters_updated_by ON public.masters(updated_by);
CREATE INDEX IF NOT EXISTS idx_parties_created_by ON public.parties(created_by);
CREATE INDEX IF NOT EXISTS idx_parties_updated_by ON public.parties(updated_by);
CREATE INDEX IF NOT EXISTS idx_designs_created_by ON public.designs(created_by);
CREATE INDEX IF NOT EXISTS idx_designs_updated_by ON public.designs(updated_by);

-- ============================================================================
-- 2. ENHANCE HELPER FUNCTIONS
-- ============================================================================

-- Core permission checking function (improved)
DROP FUNCTION IF EXISTS public.user_has_permission(uuid, varchar);
CREATE OR REPLACE FUNCTION public.user_has_permission(
  _user_id uuid,
  _permission_code varchar
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      INNER JOIN public.role_definitions rd
        ON ur.role::text = rd.role_code
      INNER JOIN public.role_permissions rp
        ON rd.id = rp.role_id
      INNER JOIN public.permissions p
        ON rp.permission_id = p.id
      WHERE ur.user_id = _user_id
        AND p.permission_code = _permission_code
        AND p.is_active = TRUE
        AND rd.is_active = TRUE
    ),
    FALSE
  );
$$;

-- Check if user is admin (frequently used optimization)
DROP FUNCTION IF EXISTS public.is_admin(uuid);
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'::public.app_role
  );
$$;

-- Check if user owns a record (helper for ownership-based authorization)
DROP FUNCTION IF EXISTS public.user_owns_record(uuid, uuid);
CREATE OR REPLACE FUNCTION public.user_owns_record(
  _user_id uuid,
  _record_owner_id uuid
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _user_id = _record_owner_id;
$$;

-- Get user's primary role
DROP FUNCTION IF EXISTS public.get_user_role(uuid);
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.role::text
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id
  ORDER BY ur.created_at DESC
  LIMIT 1;
$$;

-- ============================================================================
-- 3. ADD MISSING PERMISSION CODES
-- ============================================================================

-- Masters permissions
INSERT INTO public.permissions (permission_code, permission_name, module, action, is_system)
VALUES
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

-- ============================================================================
-- 4. REASSIGN PERMISSIONS TO ROLES
-- ============================================================================

-- Get admin and operator role IDs
WITH role_ids AS (
  SELECT
    (SELECT id FROM public.role_definitions WHERE role_code = 'admin') as admin_id,
    (SELECT id FROM public.role_definitions WHERE role_code = 'operator') as operator_id,
    (SELECT id FROM public.role_definitions WHERE role_code = 'manager') as manager_id,
    (SELECT id FROM public.role_definitions WHERE role_code = 'viewer') as viewer_id
),
new_perms AS (
  SELECT id FROM public.permissions
  WHERE permission_code IN (
    'masters.yarn:read', 'masters.yarn:create', 'masters.yarn:update', 'masters.yarn:delete',
    'masters.generic:read', 'masters.generic:create', 'masters.generic:update', 'masters.generic:delete',
    'masters.party:read', 'masters.party:create', 'masters.party:update', 'masters.party:delete',
    'design:read', 'design:create', 'design:update', 'design:delete'
  )
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT admin_id, perm_id.id
FROM role_ids, new_perms perm_id
WHERE admin_id IS NOT NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager gets read + create/update, but not delete on new permissions
WITH role_ids AS (
  SELECT (SELECT id FROM public.role_definitions WHERE role_code = 'manager') as manager_id
),
manager_perms AS (
  SELECT id FROM public.permissions
  WHERE permission_code IN (
    'masters.yarn:read', 'masters.yarn:create', 'masters.yarn:update',
    'masters.generic:read', 'masters.generic:create', 'masters.generic:update',
    'masters.party:read', 'masters.party:create', 'masters.party:update',
    'design:read', 'design:create', 'design:update'
  )
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT manager_id, perm_id.id
FROM role_ids, manager_perms perm_id
WHERE manager_id IS NOT NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Operator gets read + create/update (no delete)
WITH role_ids AS (
  SELECT (SELECT id FROM public.role_definitions WHERE role_code = 'operator') as operator_id
),
operator_perms AS (
  SELECT id FROM public.permissions
  WHERE permission_code IN (
    'masters.yarn:read', 'masters.yarn:create', 'masters.yarn:update',
    'masters.generic:read', 'masters.generic:create', 'masters.generic:update',
    'masters.party:read', 'masters.party:create', 'masters.party:update',
    'design:read', 'design:create', 'design:update'
  )
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT operator_id, perm_id.id
FROM role_ids, operator_perms perm_id
WHERE operator_id IS NOT NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Viewer gets read-only
WITH role_ids AS (
  SELECT (SELECT id FROM public.role_definitions WHERE role_code = 'viewer') as viewer_id
),
viewer_perms AS (
  SELECT id FROM public.permissions
  WHERE permission_code IN (
    'masters.yarn:read', 'masters.generic:read', 'masters.party:read', 'design:read'
  )
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT viewer_id, perm_id.id
FROM role_ids, viewer_perms perm_id
WHERE viewer_id IS NOT NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- 5. REPLACE OVERLY PERMISSIVE RLS POLICIES WITH ROLE-BASED POLICIES
-- ============================================================================

-- === MATERIALS TABLE ===
DROP POLICY IF EXISTS "materials_read" ON public.materials;
DROP POLICY IF EXISTS "materials_insert" ON public.materials;
DROP POLICY IF EXISTS "materials_update" ON public.materials;
DROP POLICY IF EXISTS "materials_delete" ON public.materials;

CREATE POLICY "materials_read" ON public.materials
FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(), 'masters.yarn:read'));

CREATE POLICY "materials_create" ON public.materials
FOR INSERT TO authenticated
WITH CHECK (
  public.user_has_permission(auth.uid(), 'masters.yarn:create')
  AND (created_by IS NULL OR created_by = auth.uid())
);

CREATE POLICY "materials_update_own" ON public.materials
FOR UPDATE TO authenticated
USING (
  public.user_has_permission(auth.uid(), 'masters.yarn:update')
  AND (created_by = auth.uid() OR public.is_admin(auth.uid()))
)
WITH CHECK (
  public.user_has_permission(auth.uid(), 'masters.yarn:update')
  AND (created_by = auth.uid() OR public.is_admin(auth.uid()))
);

CREATE POLICY "materials_delete" ON public.materials
FOR DELETE TO authenticated
USING (public.user_has_permission(auth.uid(), 'masters.yarn:delete'));

-- === MASTERS TABLE ===
DROP POLICY IF EXISTS "masters_read" ON public.masters;
DROP POLICY IF EXISTS "masters_insert" ON public.masters;
DROP POLICY IF EXISTS "masters_update" ON public.masters;
DROP POLICY IF EXISTS "masters_delete" ON public.masters;

CREATE POLICY "masters_read" ON public.masters
FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(), 'masters.generic:read'));

CREATE POLICY "masters_create" ON public.masters
FOR INSERT TO authenticated
WITH CHECK (
  public.user_has_permission(auth.uid(), 'masters.generic:create')
  AND (created_by IS NULL OR created_by = auth.uid())
);

CREATE POLICY "masters_update_own" ON public.masters
FOR UPDATE TO authenticated
USING (
  public.user_has_permission(auth.uid(), 'masters.generic:update')
  AND (created_by = auth.uid() OR public.is_admin(auth.uid()))
)
WITH CHECK (
  public.user_has_permission(auth.uid(), 'masters.generic:update')
  AND (created_by = auth.uid() OR public.is_admin(auth.uid()))
);

CREATE POLICY "masters_delete" ON public.masters
FOR DELETE TO authenticated
USING (public.user_has_permission(auth.uid(), 'masters.generic:delete'));

-- === PARTIES TABLE ===
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.parties;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.parties;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.parties;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.parties;

CREATE POLICY "parties_read" ON public.parties
FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(), 'masters.party:read'));

CREATE POLICY "parties_create" ON public.parties
FOR INSERT TO authenticated
WITH CHECK (
  public.user_has_permission(auth.uid(), 'masters.party:create')
  AND (created_by IS NULL OR created_by = auth.uid())
);

CREATE POLICY "parties_update_own" ON public.parties
FOR UPDATE TO authenticated
USING (
  public.user_has_permission(auth.uid(), 'masters.party:update')
  AND (created_by = auth.uid() OR public.is_admin(auth.uid()))
)
WITH CHECK (
  public.user_has_permission(auth.uid(), 'masters.party:update')
  AND (created_by = auth.uid() OR public.is_admin(auth.uid()))
);

CREATE POLICY "parties_delete" ON public.parties
FOR DELETE TO authenticated
USING (public.user_has_permission(auth.uid(), 'masters.party:delete'));

-- === DESIGNS TABLE ===
DROP POLICY IF EXISTS "designs_select" ON public.designs;
DROP POLICY IF EXISTS "designs_all" ON public.designs;

CREATE POLICY "designs_read" ON public.designs
FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(), 'design:read'));

CREATE POLICY "designs_create" ON public.designs
FOR INSERT TO authenticated
WITH CHECK (
  public.user_has_permission(auth.uid(), 'design:create')
  AND (created_by IS NULL OR created_by = auth.uid())
);

CREATE POLICY "designs_update_own" ON public.designs
FOR UPDATE TO authenticated
USING (
  public.user_has_permission(auth.uid(), 'design:update')
  AND (created_by = auth.uid() OR public.is_admin(auth.uid()))
)
WITH CHECK (
  public.user_has_permission(auth.uid(), 'design:update')
  AND (created_by = auth.uid() OR public.is_admin(auth.uid()))
);

CREATE POLICY "designs_delete" ON public.designs
FOR DELETE TO authenticated
USING (public.user_has_permission(auth.uid(), 'design:delete'));

-- ============================================================================
-- 6. UPDATE COST SHEETS RLS (WITH APPROVAL WORKFLOW)
-- ============================================================================

DROP POLICY IF EXISTS "cs_read" ON public.cost_sheets;
DROP POLICY IF EXISTS "cs_insert" ON public.cost_sheets;
DROP POLICY IF EXISTS "cs_update" ON public.cost_sheets;
DROP POLICY IF EXISTS "cs_delete" ON public.cost_sheets;

CREATE POLICY "cs_read" ON public.cost_sheets
FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(), 'cost_sheet:read'));

CREATE POLICY "cs_create" ON public.cost_sheets
FOR INSERT TO authenticated
WITH CHECK (
  public.user_has_permission(auth.uid(), 'cost_sheet:create')
  AND (created_by IS NULL OR created_by = auth.uid())
  AND status = 'draft'
);

-- Users can update their own draft cost sheets
CREATE POLICY "cs_update_draft" ON public.cost_sheets
FOR UPDATE TO authenticated
USING (
  public.user_has_permission(auth.uid(), 'cost_sheet:update')
  AND created_by = auth.uid()
  AND status = 'draft'
)
WITH CHECK (
  public.user_has_permission(auth.uid(), 'cost_sheet:update')
  AND created_by = auth.uid()
  AND status = 'draft'
);

-- Admin can update approved cost sheets
CREATE POLICY "cs_update_admin" ON public.cost_sheets
FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid())
  AND status = 'approved'
)
WITH CHECK (
  public.is_admin(auth.uid())
);

-- Users with approve permission can transition draft → approved
CREATE POLICY "cs_approve" ON public.cost_sheets
FOR UPDATE TO authenticated
USING (
  public.user_has_permission(auth.uid(), 'cost_sheet:approve')
  AND status = 'draft'
)
WITH CHECK (
  public.user_has_permission(auth.uid(), 'cost_sheet:approve')
  AND status IN ('draft', 'approved')
);

CREATE POLICY "cs_delete" ON public.cost_sheets
FOR DELETE TO authenticated
USING (public.user_has_permission(auth.uid(), 'cost_sheet:delete'));

-- ============================================================================
-- 7. UPDATE DETAIL TABLE RLS (COST_SHEET_LINES, COST_SHEET_CHARGES)
-- ============================================================================

-- Cost sheet lines inherit access from parent cost sheet
DROP POLICY IF EXISTS "csl_read" ON public.cost_sheet_lines;
DROP POLICY IF EXISTS "csl_write" ON public.cost_sheet_lines;

CREATE POLICY "csl_read" ON public.cost_sheet_lines
FOR SELECT TO authenticated
USING (
  public.user_has_permission(auth.uid(), 'cost_sheet:read')
  AND EXISTS (
    SELECT 1 FROM public.cost_sheets cs
    WHERE cs.id = cost_sheet_lines.cost_sheet_id
  )
);

CREATE POLICY "csl_insert" ON public.cost_sheet_lines
FOR INSERT TO authenticated
WITH CHECK (
  (
    public.user_has_permission(auth.uid(), 'cost_sheet:create')
    OR public.user_has_permission(auth.uid(), 'cost_sheet:update')
  )
  AND EXISTS (
    SELECT 1 FROM public.cost_sheets cs
    WHERE cs.id = cost_sheet_lines.cost_sheet_id
    AND cs.created_by = auth.uid()
    AND cs.status = 'draft'
  )
);

CREATE POLICY "csl_update" ON public.cost_sheet_lines
FOR UPDATE TO authenticated
USING (
  public.user_has_permission(auth.uid(), 'cost_sheet:update')
  AND EXISTS (
    SELECT 1 FROM public.cost_sheets cs
    WHERE cs.id = cost_sheet_lines.cost_sheet_id
    AND cs.created_by = auth.uid()
    AND cs.status = 'draft'
  )
)
WITH CHECK (
  public.user_has_permission(auth.uid(), 'cost_sheet:update')
  AND EXISTS (
    SELECT 1 FROM public.cost_sheets cs
    WHERE cs.id = cost_sheet_lines.cost_sheet_id
    AND cs.created_by = auth.uid()
    AND cs.status = 'draft'
  )
);

CREATE POLICY "csl_delete" ON public.cost_sheet_lines
FOR DELETE TO authenticated
USING (
  public.user_has_permission(auth.uid(), 'cost_sheet:update')
  AND EXISTS (
    SELECT 1 FROM public.cost_sheets cs
    WHERE cs.id = cost_sheet_lines.cost_sheet_id
    AND cs.created_by = auth.uid()
    AND cs.status = 'draft'
  )
);

-- Cost sheet charges (similar pattern)
DROP POLICY IF EXISTS "csc_read" ON public.cost_sheet_charges;
DROP POLICY IF EXISTS "csc_write" ON public.cost_sheet_charges;

CREATE POLICY "csc_read" ON public.cost_sheet_charges
FOR SELECT TO authenticated
USING (
  public.user_has_permission(auth.uid(), 'cost_sheet:read')
  AND EXISTS (
    SELECT 1 FROM public.cost_sheets cs
    WHERE cs.id = cost_sheet_charges.cost_sheet_id
  )
);

CREATE POLICY "csc_insert" ON public.cost_sheet_charges
FOR INSERT TO authenticated
WITH CHECK (
  (
    public.user_has_permission(auth.uid(), 'cost_sheet:create')
    OR public.user_has_permission(auth.uid(), 'cost_sheet:update')
  )
  AND EXISTS (
    SELECT 1 FROM public.cost_sheets cs
    WHERE cs.id = cost_sheet_charges.cost_sheet_id
    AND cs.created_by = auth.uid()
    AND cs.status = 'draft'
  )
);

CREATE POLICY "csc_update" ON public.cost_sheet_charges
FOR UPDATE TO authenticated
USING (
  public.user_has_permission(auth.uid(), 'cost_sheet:update')
  AND EXISTS (
    SELECT 1 FROM public.cost_sheets cs
    WHERE cs.id = cost_sheet_charges.cost_sheet_id
    AND cs.created_by = auth.uid()
    AND cs.status = 'draft'
  )
)
WITH CHECK (
  public.user_has_permission(auth.uid(), 'cost_sheet:update')
  AND EXISTS (
    SELECT 1 FROM public.cost_sheets cs
    WHERE cs.id = cost_sheet_charges.cost_sheet_id
    AND cs.created_by = auth.uid()
    AND cs.status = 'draft'
  )
);

CREATE POLICY "csc_delete" ON public.cost_sheet_charges
FOR DELETE TO authenticated
USING (
  public.user_has_permission(auth.uid(), 'cost_sheet:update')
  AND EXISTS (
    SELECT 1 FROM public.cost_sheets cs
    WHERE cs.id = cost_sheet_charges.cost_sheet_id
    AND cs.created_by = auth.uid()
    AND cs.status = 'draft'
  )
);

-- ============================================================================
-- 8. KEEP AUDIT LOG AND OTHER TABLES UNCHANGED (ALREADY SECURE)
-- ============================================================================
-- audit_log, profile_audit_log, material_rate_history remain as-is
-- They have appropriate RLS policies from earlier migrations

-- ============================================================================
-- 9. VERIFICATION
-- ============================================================================
-- Run: SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name IN (
--   'materials', 'masters', 'parties', 'designs', 'cost_sheets',
--   'cost_sheet_lines', 'cost_sheet_charges'
-- );
-- All should have RLS enabled and permission-based policies active
