import { type QueryClient, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { permissionsService } from "@/services/permissions";
import { toast } from "sonner";
import { invalidateAccess } from "@/hooks/usePermissions";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function invalidateRolePermissions(queryClient: QueryClient, roleId: string) {
  void queryClient.invalidateQueries({ queryKey: ["role-permissions", roleId] });
  void queryClient.invalidateQueries({ queryKey: ["role-permissions-by-module", roleId] });
  void queryClient.invalidateQueries({ queryKey: ["user-effective-permissions"] });
  void queryClient.invalidateQueries({ queryKey: ["user-has-permission"] });
  void queryClient.invalidateQueries({ queryKey: ["current-user-permission"] });
  invalidateAccess(queryClient);
}

export function usePermissions() {
  return useQuery({
    queryKey: ["permissions"],
    queryFn: () => permissionsService.listPermissions(),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePermissionsByModule() {
  return useQuery({
    queryKey: ["permissions-by-module"],
    queryFn: () => permissionsService.listPermissionsByModule(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRolePermissions(roleId: string) {
  return useQuery({
    queryKey: ["role-permissions", roleId],
    queryFn: () => permissionsService.getRolePermissions(roleId),
    staleTime: 5 * 60 * 1000,
    enabled: !!roleId,
  });
}

export function useRolePermissionsByModule(roleId: string) {
  return useQuery({
    queryKey: ["role-permissions-by-module", roleId],
    queryFn: () => permissionsService.getRolePermissionsByModule(roleId),
    staleTime: 5 * 60 * 1000,
    enabled: !!roleId,
  });
}

export function useGrantPermissionToRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionId }: { roleId: string; permissionId: string }) =>
      permissionsService.grantPermissionToRole(roleId, permissionId),
    onSuccess: (_, variables) => {
      invalidateRolePermissions(queryClient, variables.roleId);
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to grant permission")),
  });
}

export function useRevokePermissionFromRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionId }: { roleId: string; permissionId: string }) =>
      permissionsService.revokePermissionFromRole(roleId, permissionId),
    onSuccess: (_, variables) => {
      invalidateRolePermissions(queryClient, variables.roleId);
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to revoke permission")),
  });
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) =>
      permissionsService.updateRolePermissions(roleId, permissionIds),
    onSuccess: (_, variables) => {
      invalidateRolePermissions(queryClient, variables.roleId);
      toast.success("Permissions updated");
    },
    onError: (error, variables) => {
      // A partial save may have applied grants; reload actual backend state.
      invalidateRolePermissions(queryClient, variables.roleId);
      toast.error(errorMessage(error, "Failed to update permissions"));
    },
  });
}

export function useUserHasPermission(userId: string, permissionCode: string) {
  return useQuery({
    queryKey: ["user-has-permission", userId, permissionCode],
    queryFn: () => permissionsService.userHasPermission(userId, permissionCode),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId && !!permissionCode,
  });
}

export function useUserEffectivePermissions(userId: string) {
  return useQuery({
    queryKey: ["user-effective-permissions", userId],
    queryFn: () => permissionsService.getUserEffectivePermissions(userId),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId,
  });
}
