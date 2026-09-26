import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export class AccessError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AccessError";
  }
}

// Codes meaning "this RBAC source is not usable in the deployed database":
// missing table/relationship/column, or the recursive profiles policy (42P17).
const SOURCE_UNAVAILABLE = new Set(["PGRST205", "PGRST200", "42P01", "42703", "42P17"]);

type PgError = { code?: string; message: string };

function unavailable(error: PgError | null): boolean {
  return !!error && !!error.code && SOURCE_UNAVAILABLE.has(error.code);
}

/** The administrator system role always holds every permission. */
export const ADMIN_ROLE_CODE = "admin";

export type RoleRef = { id: string; role_code: string; role_name: string };

export type EffectivePermission = { code: string; module: string; action: string };

export type EffectiveAccess = {
  userId: string;
  status: string | null;
  roles: RoleRef[];
  primaryRoleId: string | null;
  isAdmin: boolean;
  /** Profile status is not ACTIVE: the user holds no access regardless of roles. */
  blocked: boolean;
  permissions: EffectivePermission[];
  /** RBAC sources that could not be read (surfaced to admins, never silently granted). */
  unavailableSources: string[];
};

const RoleRowSchema = z.object({
  id: z.string().uuid(),
  role_code: z.string(),
  role_name: z.string(),
  is_active: z.boolean().nullable(),
});
type RoleRow = z.infer<typeof RoleRowSchema>;

const MappingRowSchema = z.object({
  user_id: z.string().uuid(),
  role_id: z.string().uuid(),
  is_primary: z.boolean().nullable(),
  is_active: z.boolean().nullable(),
});
type MappingRow = z.infer<typeof MappingRowSchema>;

const ProfileRoleSchema = z.object({
  id: z.string().uuid(),
  status: z.string().nullable(),
  primary_role_id: z.string().nullable(),
});
type ProfileRole = z.infer<typeof ProfileRoleSchema>;

const PermissionRowSchema = z.object({
  id: z.string().uuid(),
  permission_code: z.string(),
  module: z.string(),
  action: z.string(),
  is_active: z.boolean().nullable(),
});
type PermissionRow = z.infer<typeof PermissionRowSchema>;

const RolePermissionRowSchema = z.object({
  role_id: z.string().uuid(),
  permission_id: z.string().uuid(),
});
type RolePermissionRow = z.infer<typeof RolePermissionRowSchema>;

/** Snapshot of the RBAC tables needed to resolve access for one or many users. */
export type RbacSnapshot = {
  roles: RoleRow[];
  mappings: MappingRow[];
  profiles: ProfileRole[];
  permissions: PermissionRow[];
  rolePermissions: RolePermissionRow[];
  unavailableSources: string[];
};

async function loadRoles(): Promise<RoleRow[]> {
  const { data, error } = await supabase
    .from("role_definitions")
    .select("id, role_code, role_name, is_active");
  if (error) throw new AccessError(`Failed to load roles: ${error.message}`, error.code);
  return z.array(RoleRowSchema).parse(data ?? []);
}

async function loadPermissionCatalog(): Promise<{
  permissions: PermissionRow[];
  rolePermissions: RolePermissionRow[];
}> {
  const [perms, rolePerms] = await Promise.all([
    supabase.from("permissions").select("id, permission_code, module, action, is_active"),
    supabase.from("role_permissions").select("role_id, permission_id"),
  ]);
  if (perms.error) {
    throw new AccessError(`Failed to load permissions: ${perms.error.message}`, perms.error.code);
  }
  if (rolePerms.error) {
    throw new AccessError(
      `Failed to load role permissions: ${rolePerms.error.message}`,
      rolePerms.error.code,
    );
  }
  return {
    permissions: z.array(PermissionRowSchema).parse(perms.data ?? []),
    rolePermissions: z.array(RolePermissionRowSchema).parse(rolePerms.data ?? []),
  };
}

async function loadMappings(
  userId: string | null,
  unavailableSources: string[],
): Promise<MappingRow[]> {
  let query = supabase.from("user_roles_mapping").select("user_id, role_id, is_primary, is_active");
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (unavailable(error)) {
    unavailableSources.push("user_roles_mapping");
    return [];
  }
  if (error) throw new AccessError(`Failed to load role assignments: ${error.message}`, error.code);
  return z.array(MappingRowSchema).parse(data ?? []);
}

async function loadProfiles(
  userId: string | null,
  unavailableSources: string[],
): Promise<ProfileRole[]> {
  let query = supabase.from("profiles").select("id, status, primary_role_id");
  if (userId) query = query.eq("id", userId);
  const { data, error } = await query;
  if (unavailable(error)) {
    unavailableSources.push("profiles.primary_role_id");
    return [];
  }
  if (error) throw new AccessError(`Failed to load profiles: ${error.message}`, error.code);
  return z.array(ProfileRoleSchema).parse(data ?? []);
}

export async function loadRbacSnapshot(userId: string | null = null): Promise<RbacSnapshot> {
  const unavailableSources: string[] = [];
  const [roles, catalog, mappings, profiles] = await Promise.all([
    loadRoles(),
    loadPermissionCatalog(),
    loadMappings(userId, unavailableSources),
    loadProfiles(userId, unavailableSources),
  ]);
  return { roles, ...catalog, mappings, profiles, unavailableSources };
}

/**
 * Effective access = union of permissions of every active role the user holds.
 * Explicit assignments in user_roles_mapping are authoritative. profiles.primary_role_id
 * (DB default 'viewer') is only a fallback for users with no explicit assignment, so a
 * custom role is not silently widened by the default base role.
 */
export function resolveAccess(snapshot: RbacSnapshot, userId: string): EffectiveAccess {
  const rolesById = new Map(snapshot.roles.map((r) => [r.id, r]));
  const rolesByCode = new Map(snapshot.roles.map((r) => [r.role_code.toLowerCase(), r]));
  const profile = snapshot.profiles.find((p) => p.id === userId) ?? null;

  const held = new Map<string, RoleRow>();
  let primaryRoleId: string | null = null;
  const userMappings = snapshot.mappings.filter(
    (m) => m.user_id === userId && m.is_active !== false,
  );

  for (const m of userMappings) {
    const role = rolesById.get(m.role_id);
    if (!role || role.is_active === false) continue;
    held.set(role.id, role);
    if (m.is_primary) primaryRoleId = role.id;
  }
  primaryRoleId ??= held.keys().next().value ?? null;

  if (userMappings.length === 0) {
    const profileRole = profileBaseRole(profile, rolesByCode);
    if (profileRole) {
      held.set(profileRole.id, profileRole);
      primaryRoleId = profileRole.id;
    }
  }

  const roles = [...held.values()];
  const blocked = !!profile?.status && profile.status !== "ACTIVE";
  const isAdmin = !blocked && roles.some((r) => r.role_code.toLowerCase() === ADMIN_ROLE_CODE);
  const activePermissions = snapshot.permissions.filter((p) => p.is_active !== false);

  let permissions: EffectivePermission[];
  if (blocked) {
    permissions = [];
  } else if (isAdmin) {
    permissions = activePermissions.map(toEffective);
  } else {
    const grantedIds = new Set(
      snapshot.rolePermissions.filter((rp) => held.has(rp.role_id)).map((rp) => rp.permission_id),
    );
    permissions = activePermissions.filter((p) => grantedIds.has(p.id)).map(toEffective);
  }

  return {
    userId,
    status: profile?.status ?? null,
    roles,
    primaryRoleId,
    isAdmin,
    blocked,
    permissions,
    unavailableSources: snapshot.unavailableSources,
  };
}

function profileBaseRole(
  profile: ProfileRole | null,
  rolesByCode: Map<string, RoleRow>,
): RoleRow | null {
  const code = profile?.primary_role_id?.trim().toLowerCase();
  const role = code ? rolesByCode.get(code) : undefined;
  return role && role.is_active !== false ? role : null;
}

/** True when the user's access currently comes from profiles.primary_role_id (no explicit roles). */
export function usesProfileBaseRole(snapshot: RbacSnapshot, userId: string): boolean {
  return !snapshot.mappings.some((m) => m.user_id === userId && m.is_active !== false);
}

function toEffective(p: PermissionRow): EffectivePermission {
  return { code: p.permission_code, module: p.module, action: p.action };
}

export async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export const accessService = {
  async getEffectiveAccess(userId: string): Promise<EffectiveAccess> {
    return resolveAccess(await loadRbacSnapshot(userId), userId);
  },

  async getCurrentAccess(): Promise<EffectiveAccess | null> {
    const userId = await getCurrentUserId();
    return userId ? this.getEffectiveAccess(userId) : null;
  },

  /** Everything the Users page needs, loaded once and resolved per user client-side. */
  async getAccessOverview(): Promise<RbacSnapshot> {
    return loadRbacSnapshot(null);
  },
};

export function hasPermission(access: EffectiveAccess | null | undefined, code: string): boolean {
  if (!access) return false;
  return access.isAdmin || access.permissions.some((p) => p.code === code);
}

/** Role codes accepted by the profiles.primary_role_id CHECK constraint (used by RLS). */
export const PROFILE_BASE_ROLE_CODES = ["admin", "manager", "operator", "viewer"] as const;

/**
 * Number of ACTIVE users other than `excludeUserId` who hold the administrator role.
 * Used to refuse changes that would leave the system without an administrator.
 */
export async function countOtherActiveAdmins(excludeUserId: string): Promise<number> {
  const snapshot = await loadRbacSnapshot(null);
  const userIds = new Set<string>([
    ...snapshot.mappings.map((m) => m.user_id),
    ...snapshot.profiles.map((p) => p.id),
  ]);
  userIds.delete(excludeUserId);
  let count = 0;
  for (const id of userIds) {
    if (resolveAccess(snapshot, id).isAdmin) count += 1;
  }
  return count;
}

export async function assertNotLastAdmin(userId: string, change: string): Promise<void> {
  const current = await accessService.getEffectiveAccess(userId);
  if (!current.isAdmin) return;
  if ((await countOtherActiveAdmins(userId)) === 0) {
    throw new AccessError(
      `Cannot ${change}: this user is the last active Administrator. Assign another Administrator first.`,
    );
  }
}

export type RoleSummary = { permissionCount: number; userCount: number | null };

/** Permission and assigned-user counts per role id. userCount is null if assignments are unreadable. */
export function summarizeRoles(snapshot: RbacSnapshot): Map<string, RoleSummary> {
  const activePermissionIds = new Set(
    snapshot.permissions.filter((p) => p.is_active !== false).map((p) => p.id),
  );
  const assignmentsReadable = !snapshot.unavailableSources.includes("user_roles_mapping");
  const summary = new Map<string, RoleSummary>();
  for (const role of snapshot.roles) {
    const permissionCount = snapshot.rolePermissions.filter(
      (rp) => rp.role_id === role.id && activePermissionIds.has(rp.permission_id),
    ).length;
    const users = new Set<string>();
    for (const m of snapshot.mappings) {
      if (m.role_id === role.id && m.is_active !== false) users.add(m.user_id);
    }
    for (const p of snapshot.profiles) {
      if (
        p.primary_role_id?.toLowerCase() === role.role_code.toLowerCase() &&
        usesProfileBaseRole(snapshot, p.id)
      ) {
        users.add(p.id);
      }
    }
    summary.set(role.id, {
      permissionCount,
      userCount: assignmentsReadable || users.size > 0 ? users.size : null,
    });
  }
  return summary;
}
