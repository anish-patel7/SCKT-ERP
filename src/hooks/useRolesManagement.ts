import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rolesService, type RoleUpdate } from "@/services/roles";
import { accessService } from "@/services/access";
import { invalidateAccess } from "@/hooks/usePermissions";
import { toast } from "sonner";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const ROLE_KEYS = [
  ["roles"],
  ["all-roles"],
  ["role"],
  ["user-roles"],
  ["current-user-role-codes"],
  ["current-user-is-admin"],
];

/** One snapshot of roles, assignments and grants, shared by the Roles and Users pages. */
export function useAccessOverview() {
  return useQuery({
    queryKey: ["access-overview"],
    queryFn: () => accessService.getAccessOverview(),
    staleTime: 30 * 1000,
  });
}

export function useSetPrimaryRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      rolesService.setPrimaryRole(userId, roleId),
    onSuccess: ({ profileMirrored }, { userId }) => {
      for (const queryKey of ROLE_KEYS) void queryClient.invalidateQueries({ queryKey });
      invalidateAccess(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["user-roles", userId] });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      invalidateAccess(queryClient);
      toast.success(
        profileMirrored
          ? "Primary role updated"
          : "Primary role updated (custom roles cannot be mirrored to the profile base role)",
      );
    },
    onError: (error) => {
      invalidateAccess(queryClient);
      toast.error(errorMessage(error, "Failed to change primary role"));
    },
  });
}

export function useAllRoles() {
  return useQuery({
    queryKey: ["all-roles"],
    queryFn: () => rolesService.listAllRoles(),
    staleTime: 60 * 1000,
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesService.listRoles(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRole(roleId: string) {
  return useQuery({
    queryKey: ["role", roleId],
    queryFn: () => rolesService.getRoleById(roleId),
    staleTime: 5 * 60 * 1000,
    enabled: !!roleId,
  });
}

export function useRolePermissions(roleId: string) {
  return useQuery({
    queryKey: ["role-permissions", roleId],
    queryFn: () => rolesService.getRolePermissions(roleId),
    staleTime: 5 * 60 * 1000,
    enabled: !!roleId,
  });
}

export function useRolePermissionsByModule(roleId: string) {
  return useQuery({
    queryKey: ["role-permissions-by-module", roleId],
    queryFn: () =>
      rolesService.getRolePermissions(roleId).then((perms) => {
        return perms.reduce(
          (acc, perm) => {
            const module = perm.module || "other";
            if (!acc[module]) acc[module] = [];
            acc[module].push(perm);
            return acc;
          },
          {} as Record<string, typeof perms>,
        );
      }),
    staleTime: 5 * 60 * 1000,
    enabled: !!roleId,
  });
}

export function useUserRoles(userId: string) {
  return useQuery({
    queryKey: ["user-roles", userId],
    queryFn: () => rolesService.getUserRolesV2(userId),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleName,
      roleCode,
      description,
      isActive,
    }: {
      roleName: string;
      roleCode: string;
      description?: string;
      isActive?: boolean;
    }) => rolesService.createRole(roleName, roleCode, description, isActive ?? true),
    onSuccess: () => {
      for (const queryKey of ROLE_KEYS) void queryClient.invalidateQueries({ queryKey });
      invalidateAccess(queryClient);
      toast.success("Role created successfully");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to create role")),
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, updates }: { roleId: string; updates: RoleUpdate }) =>
      rolesService.updateRole(roleId, updates),
    onSuccess: () => {
      for (const queryKey of ROLE_KEYS) void queryClient.invalidateQueries({ queryKey });
      invalidateAccess(queryClient);
      toast.success("Role updated successfully");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to update role")),
  });
}

export function useSetRoleActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, isActive }: { roleId: string; isActive: boolean }) =>
      rolesService.setRoleActive(roleId, isActive),
    onSuccess: (_, { isActive }) => {
      for (const queryKey of ROLE_KEYS) void queryClient.invalidateQueries({ queryKey });
      invalidateAccess(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["user-effective-permissions"] });
      void queryClient.invalidateQueries({ queryKey: ["current-user-permission"] });
      toast.success(isActive ? "Role reactivated" : "Role deactivated");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to update role status")),
  });
}

export function useAssignRoleToUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      roleId,
      isPrimary,
    }: {
      userId: string;
      roleId: string;
      isPrimary?: boolean;
    }) => rolesService.assignRoleToUser(userId, roleId, isPrimary),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["user-roles", variables.userId] });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["user-effective-permissions"] });
      void queryClient.invalidateQueries({ queryKey: ["current-user-permission"] });
      void queryClient.invalidateQueries({ queryKey: ["current-user-is-admin"] });
      void queryClient.invalidateQueries({ queryKey: ["current-user-role-codes"] });
      invalidateAccess(queryClient);
      toast.success("Role assigned");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to assign role")),
  });
}

export function useRemoveRoleFromUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      rolesService.removeRoleFromUser(userId, roleId),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["user-roles", variables.userId] });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["user-effective-permissions"] });
      void queryClient.invalidateQueries({ queryKey: ["current-user-permission"] });
      void queryClient.invalidateQueries({ queryKey: ["current-user-is-admin"] });
      void queryClient.invalidateQueries({ queryKey: ["current-user-role-codes"] });
      invalidateAccess(queryClient);
      toast.success("Role removed");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to remove role")),
  });
}
