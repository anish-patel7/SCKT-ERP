import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rolesService } from "@/services/roles";
import type { AppRole } from "@/lib/validators/auth";
import { useAuth } from "@/hooks/useAuth";

/**
 * Query for all role definitions
 */
export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesService.listRoles(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Query for specific role by code
 */
export function useRole(roleCode: string) {
  return useQuery({
    queryKey: ["role", roleCode],
    queryFn: () => rolesService.getRoleByCode(roleCode),
    staleTime: 10 * 60 * 1000,
    enabled: !!roleCode,
  });
}

/**
 * Query for all permissions
 */
export function usePermissions(module?: string) {
  return useQuery({
    queryKey: ["permissions", module],
    queryFn: () => rolesService.listPermissions(module ? { module } : undefined),
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Query for permissions by module
 */
export function usePermissionsByModule(module: string) {
  return useQuery({
    queryKey: ["permissions", "module", module],
    queryFn: () => rolesService.getPermissionsByModule(module),
    staleTime: 10 * 60 * 1000,
    enabled: !!module,
  });
}

/**
 * Query for role permissions
 */
export function useRolePermissions(roleId: string) {
  return useQuery({
    queryKey: ["role-permissions", roleId],
    queryFn: () => rolesService.getRolePermissions(roleId),
    staleTime: 10 * 60 * 1000,
    enabled: !!roleId,
  });
}

/**
 * Query for user's roles (V2 - using user_roles_mapping table)
 */
export function useUserRoles(userId: string) {
  return useQuery({
    queryKey: ["user-roles", userId],
    queryFn: () => rolesService.getUserRolesV2(userId),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId,
  });
}

/**
 * Query for current user's roles (V2 - using user_roles_mapping table)
 */
export function useCurrentUserRoles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["current-user-role-codes", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      const codes = await rolesService.getUserRoleCodes(user.id);
      return codes.map((role_code) => ({ role_code }));
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.id,
  });
}

/**
 * Check if user has a specific role by role code
 */
export function useHasRole(userId: string, roleCode: string) {
  return useQuery({
    queryKey: ["user-has-role", userId, roleCode],
    queryFn: async () => {
      const roles = await rolesService.getUserRolesV2(userId);
      return roles.some((r) => r.role_code === roleCode);
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!userId,
  });
}

/**
 * Check if current user has a specific role by role code
 */
export function useCurrentUserHasRole(roleCode: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-has-role", user?.id, roleCode],
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      const codes = await rolesService.getUserRoleCodes(user.id);
      return codes.includes(roleCode.toLowerCase());
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.id,
  });
}

/**
 * Check if user has permission
 */
export function useHasPermission(userId: string, permissionCode: string) {
  return useQuery({
    queryKey: ["user-has-permission", userId, permissionCode],
    queryFn: () => rolesService.userHasPermission(userId, permissionCode),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId && !!permissionCode,
  });
}

/**
 * Check if current user has permission
 */
export function useCurrentUserHasPermission(permissionCode: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-has-permission", user?.id, permissionCode],
    queryFn: () => {
      if (!user?.id) throw new Error("User not authenticated");
      return rolesService.userHasPermission(user.id, permissionCode);
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.id && !!permissionCode,
  });
}

/**
 * Mutation for assigning role to user (V2 - using user_roles_mapping)
 */
export function useAssignRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, roleId, isPrimary }: { userId: string; roleId: string; isPrimary?: boolean }) =>
      rolesService.assignRoleToUser(userId, roleId, isPrimary),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({
        queryKey: ["user-roles", userId],
      });
    },
  });
}

/**
 * Mutation for removing role from user (V2 - using user_roles_mapping)
 */
export function useRemoveRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      rolesService.removeRoleFromUser(userId, roleId),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["user-roles", userId] });
    },
  });
}

/**
 * Query for all modules
 */
export function useModules() {
  return useQuery({
    queryKey: ["modules"],
    queryFn: () => rolesService.getModules(),
    staleTime: 10 * 60 * 1000,
  });
}
