import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { auditService } from "@/services/audit";
import {
  EffectivePermissionSchema,
  PermissionSchema,
  type EffectivePermission,
  type Permission,
} from "@/lib/validators/auth";

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

export type { Permission, EffectivePermission };

export const RolePermissionSchema = z.object({
  id: z.string().uuid(),
  role_id: z.string().uuid(),
  permission_id: z.string().uuid(),
  created_at: z.string().datetime({ offset: true }).nullable(),
});

export type RolePermission = z.infer<typeof RolePermissionSchema>;

function groupByModule(permissions: Permission[]): Record<string, Permission[]> {
  const grouped: Record<string, Permission[]> = {};
  for (const perm of permissions) {
    (grouped[perm.module] ??= []).push(perm);
  }
  return grouped;
}

export const permissionsService = {
  async listPermissions(): Promise<Permission[]> {
    const { data, error } = await supabase
      .from("permissions")
      .select("*")
      .eq("is_active", true)
      .order("module", { ascending: true })
      .order("action", { ascending: true });

    if (error) {
      throw new PermissionError(`Failed to fetch permissions: ${error.message}`);
    }

    return z.array(PermissionSchema).parse(data ?? []);
  },

  async listPermissionsByModule(): Promise<Record<string, Permission[]>> {
    return groupByModule(await this.listPermissions());
  },

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const { data, error } = await supabase
      .from("role_permissions")
      .select(
        "permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at)",
      )
      .eq("role_id", roleId);

    if (error) {
      throw new PermissionError(`Failed to fetch role permissions: ${error.message}`);
    }

    return z
      .array(z.object({ permissions: PermissionSchema.nullable() }))
      .parse(data ?? [])
      .flatMap((row) => (row.permissions ? [row.permissions] : []));
  },

  async getRolePermissionsByModule(roleId: string): Promise<Record<string, Permission[]>> {
    return groupByModule(await this.getRolePermissions(roleId));
  },

  async grantPermissionToRole(roleId: string, permissionId: string): Promise<RolePermission> {
    const { data, error } = await supabase
      .from("role_permissions")
      .upsert(
        { role_id: roleId, permission_id: permissionId },
        { onConflict: "role_id,permission_id" },
      )
      .select()
      .single();

    if (error) {
      throw new PermissionError(`Failed to grant permission: ${error.message}`);
    }

    return RolePermissionSchema.parse(data);
  },

  async revokePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    const { error } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId)
      .eq("permission_id", permissionId);

    if (error) {
      throw new PermissionError(`Failed to revoke permission: ${error.message}`);
    }
  },

  /**
   * Replace a role's permission set. The backend has no atomic replace RPC, so this
   * applies additions before removals: a mid-way failure can leave extra grants,
   * but never strips the role of permissions it should keep.
   */
  async updateRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    const { data, error } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId);

    if (error) {
      throw new PermissionError(`Failed to read current role permissions: ${error.message}`);
    }

    const current = new Set(
      z
        .array(z.object({ permission_id: z.string().uuid() }))
        .parse(data ?? [])
        .map((r) => r.permission_id),
    );
    const desired = new Set(permissionIds);
    const toAdd = [...desired].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !desired.has(id));

    if (toAdd.length > 0) {
      const { error: insertError } = await supabase.from("role_permissions").upsert(
        toAdd.map((permission_id) => ({ role_id: roleId, permission_id })),
        { onConflict: "role_id,permission_id" },
      );
      if (insertError) {
        throw new PermissionError(`Failed to grant permissions: ${insertError.message}`);
      }
    }

    if (toRemove.length > 0) {
      const { error: deleteError } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", roleId)
        .in("permission_id", toRemove);
      if (deleteError) {
        throw new PermissionError(
          `Granted new permissions but failed to revoke removed ones: ${deleteError.message}`,
        );
      }
    }

    if (toAdd.length > 0 || toRemove.length > 0) {
      const { data: catalog } = await supabase
        .from("permissions")
        .select("id, permission_code")
        .in("id", [...toAdd, ...toRemove]);
      const codeOf = new Map((catalog ?? []).map((p) => [p.id, p.permission_code]));
      const describe = (ids: string[]) => ids.map((id) => codeOf.get(id) ?? id).join(", ");
      if (toAdd.length > 0) {
        await auditService.record(
          "role_permissions",
          roleId,
          "PERMISSIONS_GRANTED",
          describe(toAdd),
        );
      }
      if (toRemove.length > 0) {
        await auditService.record(
          "role_permissions",
          roleId,
          "PERMISSIONS_REVOKED",
          describe(toRemove),
        );
      }
    }
  },

  async userHasPermission(userId: string, permissionCode: string): Promise<boolean> {
    const { data, error } = await supabase.rpc("user_has_permission_v2", {
      _user_id: userId,
      _permission_code: permissionCode,
    });

    if (error) {
      throw new PermissionError(`Permission check failed: ${error.message}`);
    }

    return z.boolean().parse(data);
  },

  async getUserEffectivePermissions(userId: string): Promise<EffectivePermission[]> {
    const { data, error } = await supabase.rpc("get_user_effective_permissions", {
      _user_id: userId,
    });

    if (error) {
      throw new PermissionError(`Failed to fetch user permissions: ${error.message}`);
    }

    return z.array(EffectivePermissionSchema).parse(data ?? []);
  },
};
