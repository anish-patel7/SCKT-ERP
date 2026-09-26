import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import type { Permission, RoleDefinition } from "@/lib/validators/auth";
import { RoleDefinitionSchema } from "@/lib/validators/auth";
import { permissionsService } from "@/services/permissions";
import { auditService } from "@/services/audit";
import {
  ADMIN_ROLE_CODE,
  PROFILE_BASE_ROLE_CODES,
  assertNotLastAdmin,
  loadRbacSnapshot,
  resolveAccess,
  usesProfileBaseRole,
} from "@/services/access";

export class RoleError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "RoleError";
  }
}

export type RoleUpdate = {
  role_name?: string;
  description?: string | null;
  display_order?: number | null;
};

const ROLE_COLUMNS =
  "id, role_code, role_name, description, display_order, is_system, is_active, created_at, updated_at";

export const rolesService = {
  /** Active roles only (for pickers and the permission matrix). */
  async listRoles(): Promise<RoleDefinition[]> {
    const { data, error } = await supabase
      .from("role_definitions")
      .select(ROLE_COLUMNS)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      throw new RoleError(`Failed to fetch roles: ${error.message}`);
    }

    return z.array(RoleDefinitionSchema).parse(data ?? []);
  },

  /** All roles including inactive ones (for role administration). */
  async listAllRoles(): Promise<RoleDefinition[]> {
    const { data, error } = await supabase
      .from("role_definitions")
      .select(ROLE_COLUMNS)
      .order("display_order", { ascending: true });

    if (error) {
      throw new RoleError(`Failed to fetch roles: ${error.message}`);
    }

    return z.array(RoleDefinitionSchema).parse(data ?? []);
  },

  async getRoleById(roleId: string): Promise<RoleDefinition> {
    const { data, error } = await supabase
      .from("role_definitions")
      .select(ROLE_COLUMNS)
      .eq("id", roleId)
      .single();

    if (error) {
      throw new RoleError(`Failed to fetch role: ${error.message}`);
    }

    return RoleDefinitionSchema.parse(data);
  },

  async getRoleByCode(roleCode: string): Promise<RoleDefinition> {
    const { data, error } = await supabase
      .from("role_definitions")
      .select(ROLE_COLUMNS)
      .eq("role_code", roleCode)
      .single();

    if (error) {
      throw new RoleError(`Failed to fetch role: ${error.message}`);
    }

    return RoleDefinitionSchema.parse(data);
  },

  async listPermissions(filters?: { module?: string }): Promise<Permission[]> {
    const all = await permissionsService.listPermissions();
    return filters?.module ? all.filter((p) => p.module === filters.module) : all;
  },

  async getPermissionsByModule(module: string): Promise<Permission[]> {
    return this.listPermissions({ module });
  },

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    return permissionsService.getRolePermissions(roleId);
  },

  async getRolePermissionsByCode(roleCode: string): Promise<Permission[]> {
    const role = await this.getRoleByCode(roleCode);
    return permissionsService.getRolePermissions(role.id);
  },

  async userHasPermission(userId: string, permissionCode: string): Promise<boolean> {
    return permissionsService.userHasPermission(userId, permissionCode);
  },

  async updateRole(roleId: string, updates: RoleUpdate): Promise<RoleDefinition> {
    const patch: RoleUpdate & { updated_at: string } = { updated_at: new Date().toISOString() };
    if (updates.role_name !== undefined) {
      const name = updates.role_name.trim();
      if (!name) throw new RoleError("Role name is required");
      patch.role_name = name;
    }
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.display_order !== undefined) patch.display_order = updates.display_order;

    const { data, error } = await supabase
      .from("role_definitions")
      .update(patch)
      .eq("id", roleId)
      .select(ROLE_COLUMNS)
      .single();

    if (error) {
      throw new RoleError(`Failed to update role: ${error.message}`);
    }

    const updated = RoleDefinitionSchema.parse(data);
    await auditService.record(
      "role",
      roleId,
      "ROLE_EDITED",
      `${updated.role_name} (${updated.role_code}): ${Object.keys(patch)
        .filter((k) => k !== "updated_at")
        .join(", ")}`,
    );
    return updated;
  },

  async createRole(
    roleName: string,
    roleCode: string,
    description?: string,
    isActive = true,
  ): Promise<RoleDefinition> {
    const { data: existing, error: existError } = await supabase
      .from("role_definitions")
      .select("id")
      .eq("role_code", roleCode)
      .maybeSingle();

    if (existError) {
      throw new RoleError(`Failed to validate role code: ${existError.message}`);
    }
    if (existing) {
      throw new RoleError(`Role code "${roleCode}" already exists`);
    }

    const { data: maxOrder, error: orderError } = await supabase
      .from("role_definitions")
      .select("display_order")
      .order("display_order", { ascending: false, nullsFirst: false })
      .limit(1);

    if (orderError) {
      throw new RoleError(`Failed to create role: ${orderError.message}`);
    }

    const nextOrder = (maxOrder?.[0]?.display_order ?? 0) + 1;

    const { data, error } = await supabase
      .from("role_definitions")
      .insert({
        role_code: roleCode,
        role_name: roleName,
        description: description || null,
        display_order: nextOrder,
        is_system: false,
        is_active: isActive,
      })
      .select(ROLE_COLUMNS)
      .single();

    if (error) {
      throw new RoleError(`Failed to create role: ${error.message}`);
    }

    const created = RoleDefinitionSchema.parse(data);
    await auditService.record("role", created.id, "ROLE_CREATED", `${roleName} (${roleCode})`);
    return created;
  },

  async setRoleActive(roleId: string, isActive: boolean): Promise<RoleDefinition> {
    const role = await this.getRoleById(roleId);
    if ((role.is_system || role.role_code.toLowerCase() === ADMIN_ROLE_CODE) && !isActive) {
      throw new RoleError(`Cannot deactivate system role: ${role.role_name}`);
    }

    const { data, error } = await supabase
      .from("role_definitions")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", roleId)
      .select(ROLE_COLUMNS)
      .single();

    if (error) {
      throw new RoleError(
        `Failed to ${isActive ? "reactivate" : "deactivate"} role: ${error.message}`,
      );
    }

    await auditService.record(
      "role",
      roleId,
      isActive ? "ROLE_ACTIVATED" : "ROLE_DEACTIVATED",
      `${role.role_name} (${role.role_code})`,
    );
    return RoleDefinitionSchema.parse(data);
  },

  async deactivateRole(roleId: string): Promise<RoleDefinition> {
    return this.setRoleActive(roleId, false);
  },

  async assignRoleToUser(userId: string, roleId: string, isPrimary = false): Promise<void> {
    // The first explicit assignment replaces the profile base role for application access.
    // Preserve Administrator so an admin-by-profile user is never silently demoted.
    const snapshot = await loadRbacSnapshot(userId);
    if (usesProfileBaseRole(snapshot, userId)) {
      const before = resolveAccess(snapshot, userId);
      const adminRole = snapshot.roles.find((r) => r.role_code.toLowerCase() === ADMIN_ROLE_CODE);
      if (before.isAdmin && adminRole && adminRole.id !== roleId) {
        const { error: keepError } = await supabase
          .from("user_roles_mapping")
          .upsert(
            { user_id: userId, role_id: adminRole.id, is_primary: !isPrimary, is_active: true },
            { onConflict: "user_id,role_id" },
          );
        if (keepError) {
          throw new RoleError(
            `Failed to preserve Administrator role: ${keepError.message}`,
            keepError.code,
          );
        }
      }
    }

    if (isPrimary) {
      const { error: clearError } = await supabase
        .from("user_roles_mapping")
        .update({ is_primary: false })
        .eq("user_id", userId)
        .eq("is_primary", true);
      if (clearError) {
        throw new RoleError(`Failed to update primary role: ${clearError.message}`);
      }
    }

    const { error } = await supabase
      .from("user_roles_mapping")
      .upsert(
        { user_id: userId, role_id: roleId, is_primary: isPrimary, is_active: true },
        { onConflict: "user_id,role_id" },
      );

    if (error) {
      throw new RoleError(`Failed to assign role: ${error.message}`, error.code);
    }

    const role = await this.getRoleById(roleId);
    await auditService.record(
      "user_role",
      userId,
      "ROLE_ASSIGNED",
      `${role.role_name} (${role.role_code})${isPrimary ? " as primary" : ""}`,
    );
  },

  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    const role = await this.getRoleById(roleId);
    if (role.role_code.toLowerCase() === ADMIN_ROLE_CODE) {
      await assertNotLastAdmin(userId, "remove the Administrator role");
    }

    const { error } = await supabase
      .from("user_roles_mapping")
      .delete()
      .eq("user_id", userId)
      .eq("role_id", roleId);

    if (error) {
      throw new RoleError(`Failed to remove role: ${error.message}`, error.code);
    }

    await auditService.record(
      "user_role",
      userId,
      "ROLE_REMOVED",
      `${role.role_name} (${role.role_code})`,
    );
  },

  /**
   * Make a role the user's primary role. When the role code is one that
   * profiles.primary_role_id accepts, it is mirrored there because RLS policies read it.
   */
  async setPrimaryRole(userId: string, roleId: string): Promise<{ profileMirrored: boolean }> {
    const role = await this.getRoleById(roleId);
    const code = role.role_code.toLowerCase();
    if (code !== ADMIN_ROLE_CODE) {
      await assertNotLastAdmin(userId, "change the primary role away from Administrator");
    }

    await this.assignRoleToUser(userId, roleId, true);

    const mirrorable = (PROFILE_BASE_ROLE_CODES as readonly string[]).includes(code);
    if (!mirrorable) return { profileMirrored: false };

    const { error } = await supabase
      .from("profiles")
      .update({ primary_role_id: code, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) {
      throw new RoleError(
        `Primary role saved, but the profile base role used by data-access rules could not be updated: ${error.message}`,
        error.code,
      );
    }
    await auditService.record(
      "user_role",
      userId,
      "PRIMARY_ROLE_CHANGED",
      `${role.role_name} (${code})`,
    );
    return { profileMirrored: true };
  },

  /** Active roles assigned to a user via user_roles_mapping (canonical RBAC source). */
  async getUserRolesV2(userId: string): Promise<RoleDefinition[]> {
    const { data, error } = await supabase
      .from("user_roles_mapping")
      .select(`role_definitions (${ROLE_COLUMNS})`)
      .eq("user_id", userId)
      .eq("is_active", true);

    if (error) {
      throw new RoleError(`Failed to fetch user roles: ${error.message}`, error.code);
    }

    return z
      .array(z.object({ role_definitions: RoleDefinitionSchema.nullable() }))
      .parse(data ?? [])
      .flatMap((row) => (row.role_definitions ? [row.role_definitions] : []));
  },

  /** Lower-cased codes of the active roles a user holds (same resolution as effective access). */
  async getUserRoleCodes(userId: string): Promise<string[]> {
    const access = resolveAccess(await loadRbacSnapshot(userId), userId);
    return access.roles.map((r) => r.role_code.toLowerCase());
  },

  async getModules(): Promise<string[]> {
    const permissions = await permissionsService.listPermissions();
    return [...new Set(permissions.map((p) => p.module))].sort();
  },
};
