-- ============================================================================
-- MIGRATION 007A: Permission Matrix V2 — granular System permissions
-- Date: 2026-09-27
--
-- Why:
--   User and role administration was controlled by one coarse permission,
--   user_management:write. It could not express "may view users but not
--   create them", "may approve registrations but not assign roles", etc.
--
-- Final System permission model (naming follows the existing <module>:<action>
-- convention; permissions.module / permissions.action carry the metadata):
--
--   Users (module user_management)
--     user_management:read         view users & their access          (existing)
--     user_management:create       create users (future Admin Add User) (new)
--     user_management:update       edit profile details, activate /
--                                  deactivate (no hard delete)          (new)
--     user_management:approve      approve / reject registrations       (new)
--     user_management:assign_role  assign / remove roles, set primary   (new)
--     user_management:write        LEGACY aggregate. Kept: still gates
--                                  backup / WhatsApp / data migration
--                                  screens. No longer used by RLS.     (existing)
--
--   Roles / Access Groups (module role_management)
--     role_management:read                view roles & permission matrix (new)
--     role_management:create              create custom roles           (new)
--     role_management:update              edit / activate / deactivate  (new)
--     role_management:assign_permissions  change a role's permissions   (new)
--
--   Audit (module audit)
--     audit:read                   view-only; unchanged
--
-- Compatibility (no role loses or gains effective capability):
--   * roles holding user_management:write receive every new granular
--     user_management / role_management permission (it previously allowed all
--     of them via RLS);
--   * roles holding user_management:read or user_management:write receive
--     role_management:read (the Roles and Permission Matrix screens were
--     previously gated by user_management:read);
--   * the admin role receives every new permission (is_admin() already grants
--     everything; the rows keep role_permissions consistent with bootstrap).
--   Roles without those permissions receive nothing. No existing grant or
--   permission is deleted; role_permissions is never reset.
--
-- Backend enforcement moves from user_management:write to the granular codes:
--   role_definitions INSERT            -> role_management:create
--   role_definitions UPDATE            -> role_management:update
--   role_permissions INSERT/UPDATE/DEL -> role_management:assign_permissions
--   user_roles_mapping INSERT/UPD/DEL  -> user_management:assign_role
--   profiles UPDATE (other users)      -> update | approve | assign_role,
--                                         narrowed per column by the guard
--                                         trigger below
--   profiles DELETE                    -> removed (deactivate instead)
--
-- Safe to re-run.
-- Rollback (manual): re-run section D/E of 20260924_005A_rbac_single_authority.sql
-- to restore the user_management:write policies and guard trigger. The new
-- permission rows can stay (unused) or be set is_active = FALSE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. Permission catalog (insert-only; never overwrites existing rows)
-- ----------------------------------------------------------------------------
INSERT INTO public.permissions (permission_code, permission_name, description, module, action, is_system)
VALUES
  ('user_management:create', 'Create Users',
   'Create user accounts (server-side Admin path).', 'user_management', 'create', TRUE),
  ('user_management:update', 'Edit Users',
   'Edit user profile details and activate / deactivate users. Users are never hard-deleted.',
   'user_management', 'update', TRUE),
  ('user_management:approve', 'Approve Users',
   'Approve or reject pending registration requests.', 'user_management', 'approve', TRUE),
  ('user_management:assign_role', 'Assign Roles to Users',
   'Assign or remove Roles / Access Groups on users and set the primary role.',
   'user_management', 'assign_role', TRUE),
  ('role_management:read', 'View Roles',
   'View Roles / Access Groups and the Permission Matrix.', 'role_management', 'read', TRUE),
  ('role_management:create', 'Create Roles',
   'Create custom Roles / Access Groups.', 'role_management', 'create', TRUE),
  ('role_management:update', 'Edit Roles',
   'Edit, activate and deactivate Roles / Access Groups.', 'role_management', 'update', TRUE),
  ('role_management:assign_permissions', 'Assign Permissions to Roles',
   'Change the permissions granted to a Role / Access Group.',
   'role_management', 'assign_permissions', TRUE)
ON CONFLICT (permission_code) DO NOTHING;

-- Describe the legacy aggregate so the matrix can explain it (description only).
UPDATE public.permissions
SET description = 'Legacy aggregate. Superseded by the granular user_management / role_management '
                  'permissions; still gates Backup, WhatsApp and Data Migration screens.',
    updated_at = NOW()
WHERE permission_code = 'user_management:write'
  AND description IS NULL;

-- ----------------------------------------------------------------------------
-- B. Compatibility grants (additive only)
-- ----------------------------------------------------------------------------
-- B1. Legacy user_management:write -> every new granular admin permission.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rp.role_id, np.id
FROM public.role_permissions rp
JOIN public.permissions legacy ON legacy.id = rp.permission_id
  AND legacy.permission_code = 'user_management:write'
JOIN public.permissions np ON np.permission_code IN (
  'user_management:create', 'user_management:update', 'user_management:approve',
  'user_management:assign_role', 'role_management:read', 'role_management:create',
  'role_management:update', 'role_management:assign_permissions'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- B2. Anyone who could open the Roles / Permission Matrix screens keeps that.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, np.id
FROM public.role_permissions rp
JOIN public.permissions legacy ON legacy.id = rp.permission_id
  AND legacy.permission_code = 'user_management:read'
JOIN public.permissions np ON np.permission_code = 'role_management:read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- B3. Administrator role rows (is_admin() already implies all permissions).
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rd.id, p.id
FROM public.role_definitions rd
JOIN public.permissions p ON p.module IN ('user_management', 'role_management')
WHERE rd.role_code = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- C. RBAC table policies: granular codes instead of user_management:write
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "role_defs_manage" ON public.role_definitions;
CREATE POLICY "role_defs_manage" ON public.role_definitions
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission(auth.uid(), 'role_management:create'));

DROP POLICY IF EXISTS "role_defs_update" ON public.role_definitions;
CREATE POLICY "role_defs_update" ON public.role_definitions
  FOR UPDATE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'role_management:update'))
  WITH CHECK (
    public.user_has_permission(auth.uid(), 'role_management:update')
    -- the Administrator role can never be deactivated
    AND NOT (role_code = 'admin' AND is_active IS FALSE)
  );

DROP POLICY IF EXISTS "role_perms_insert" ON public.role_permissions;
CREATE POLICY "role_perms_insert" ON public.role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission(auth.uid(), 'role_management:assign_permissions'));
DROP POLICY IF EXISTS "role_perms_update" ON public.role_permissions;
CREATE POLICY "role_perms_update" ON public.role_permissions
  FOR UPDATE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'role_management:assign_permissions'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'role_management:assign_permissions'));
DROP POLICY IF EXISTS "role_perms_delete" ON public.role_permissions;
CREATE POLICY "role_perms_delete" ON public.role_permissions
  FOR DELETE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'role_management:assign_permissions'));

DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles_mapping;
CREATE POLICY "user_roles_insert" ON public.user_roles_mapping
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission(auth.uid(), 'user_management:assign_role'));
DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles_mapping;
CREATE POLICY "user_roles_update" ON public.user_roles_mapping
  FOR UPDATE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'user_management:assign_role'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'user_management:assign_role'));
DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles_mapping;
CREATE POLICY "user_roles_delete" ON public.user_roles_mapping
  FOR DELETE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'user_management:assign_role'));

-- ----------------------------------------------------------------------------
-- D. profiles: row access by any user-administration capability; the guard
--    trigger decides which columns each capability may change.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_update_managed" ON public.profiles;
CREATE POLICY "profiles_update_managed" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.user_has_permission(auth.uid(), 'user_management:update')
    OR public.user_has_permission(auth.uid(), 'user_management:approve')
    OR public.user_has_permission(auth.uid(), 'user_management:assign_role')
  )
  WITH CHECK (
    public.user_has_permission(auth.uid(), 'user_management:update')
    OR public.user_has_permission(auth.uid(), 'user_management:approve')
    OR public.user_has_permission(auth.uid(), 'user_management:assign_role')
  );

-- Users are deactivated, never hard-deleted from the client.
DROP POLICY IF EXISTS "profiles_delete_managed" ON public.profiles;
REVOKE DELETE ON public.profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  can_update boolean;
  can_approve boolean;
  can_assign boolean;
  approval_changed boolean;
  role_changed boolean;
  status_changed boolean;
  admin_flags_changed boolean;
  details_changed boolean;
  new_row jsonb := to_jsonb(NEW);
  old_row jsonb := to_jsonb(OLD);
  privileged text[] := ARRAY[
    'primary_role_id', 'additional_role_ids', 'status', 'approval_status',
    'approved_by', 'approved_at', 'is_locked', 'creation_method', 'updated_at'
  ];
BEGIN
  -- auth.uid() is NULL for service-role / SQL editor / internal triggers.
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;

  can_update := public.user_has_permission(actor, 'user_management:update');
  can_approve := public.user_has_permission(actor, 'user_management:approve');
  can_assign := public.user_has_permission(actor, 'user_management:assign_role');

  approval_changed := (new_row -> 'approval_status') IS DISTINCT FROM (old_row -> 'approval_status')
    OR (new_row -> 'approved_by') IS DISTINCT FROM (old_row -> 'approved_by')
    OR (new_row -> 'approved_at') IS DISTINCT FROM (old_row -> 'approved_at');
  role_changed := NEW.primary_role_id IS DISTINCT FROM OLD.primary_role_id
    OR (new_row -> 'additional_role_ids') IS DISTINCT FROM (old_row -> 'additional_role_ids');
  status_changed := NEW.status IS DISTINCT FROM OLD.status;
  admin_flags_changed := (new_row -> 'is_locked') IS DISTINCT FROM (old_row -> 'is_locked')
    OR (new_row -> 'creation_method') IS DISTINCT FROM (old_row -> 'creation_method');
  details_changed := (new_row - privileged) IS DISTINCT FROM (old_row - privileged);

  IF approval_changed AND NOT can_approve THEN
    RAISE EXCEPTION 'Not allowed to approve or reject users (requires user_management:approve)'
      USING ERRCODE = '42501';
  END IF;

  IF role_changed AND NOT can_assign THEN
    RAISE EXCEPTION 'Not allowed to change user roles (requires user_management:assign_role)'
      USING ERRCODE = '42501';
  END IF;

  -- Status may change as part of an approval decision, otherwise it is an edit.
  IF status_changed AND NOT (can_update OR (approval_changed AND can_approve)) THEN
    RAISE EXCEPTION 'Not allowed to change user status (requires user_management:update)'
      USING ERRCODE = '42501';
  END IF;

  IF admin_flags_changed AND NOT can_update THEN
    RAISE EXCEPTION 'Not allowed to change user account flags (requires user_management:update)'
      USING ERRCODE = '42501';
  END IF;

  -- Users may edit their own details; other users' details need update.
  IF details_changed AND NEW.id IS DISTINCT FROM actor AND NOT can_update THEN
    RAISE EXCEPTION 'Not allowed to edit other users (requires user_management:update)'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- E. Verification (read-only; run manually after applying)
-- ----------------------------------------------------------------------------
-- SELECT rd.role_code, p.permission_code
-- FROM public.role_permissions rp
-- JOIN public.role_definitions rd ON rd.id = rp.role_id
-- JOIN public.permissions p ON p.id = rp.permission_id
-- WHERE p.module IN ('user_management', 'role_management', 'audit')
-- ORDER BY rd.role_code, p.permission_code;
