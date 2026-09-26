import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
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
    }) =>
      rolesService.createRole(
        roleName,
        roleCode,
        description,
        isActive ?? true,
      ),
    onSuccess: () => {
      for (const queryKey of ROLE_KEYS)
        void queryClient.invalidateQueries({ queryKey });
      invalidateAccess(queryClient);
      toast.success("Role created successfully");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Failed to create role")),
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleId,
      updates,
    }: {
      roleId: string;
      updates: RoleUpdate;
    }) => rolesService.updateRole(roleId, updates),
    onSuccess: () => {
      for (const queryKey of ROLE_KEYS)
        void queryClient.invalidateQueries({ queryKey });
      invalidateAccess(queryClient);
      toast.success("Role updated successfully");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Failed to update role")),
  });
}

export function useSetRoleActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, isActive }: { roleId: string; isActive: boolean }) =>
      rolesService.setRoleActive(roleId, isActive),
    onSuccess: (_, { isActive }) => {
      for (const queryKey of ROLE_KEYS)
        void queryClient.invalidateQueries({ queryKey });
      invalidateAccess(queryClient);
      void queryClient.invalidateQueries({
        queryKey: ["user-effective-permissions"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["current-user-permission"],
      });
      toast.success(isActive ? "Role reactivated" : "Role deactivated");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Failed to update role status")),
  });
}

/** Readable message for a failed user-role change; never shows raw database errors. */
function roleAssignmentMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code ?? "")
      : "";
  if (/last active Administrator/i.test(message)) {
    return "You cannot remove the last Administrator";
  }
  if (
    code === "42501" ||
    /row-level security|not allowed|permission denied/i.test(message)
  ) {
    return "You are not authorized to change role assignments";
  }
  return "Unable to update role assignment";
}

/** Refresh users, assignments, role counts and permission-derived state (incl. own sidebar). */
function invalidateRoleAssignments(
  queryClient: QueryClient,
  userId: string,
): void {
  for (const queryKey of ROLE_KEYS)
    void queryClient.invalidateQueries({ queryKey });
  void queryClient.invalidateQueries({ queryKey: ["user-roles", userId] });
  void queryClient.invalidateQueries({ queryKey: ["users"] });
  void queryClient.invalidateQueries({
    queryKey: ["user-effective-permissions"],
  });
  void queryClient.invalidateQueries({ queryKey: ["current-user-permission"] });
  invalidateAccess(queryClient);
}

function useRoleAssignmentMutation<V extends { userId: string }, R>(
  mutationFn: (variables: V) => Promise<R>,
  successMessage: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_, { userId }) => {
      invalidateRoleAssignments(queryClient, userId);
      toast.success(successMessage);
    },
    onError: (error, { userId }) => {
      console.error("Role assignment failed:", error);
      invalidateRoleAssignments(queryClient, userId);
      toast.error(roleAssignmentMessage(error));
    },
  });
}

export function useAssignRoleToUser() {
  return useRoleAssignmentMutation(
    ({
      userId,
      roleId,
      isPrimary,
    }: {
      userId: string;
      roleId: string;
      isPrimary?: boolean;
    }) => rolesService.assignRoleToUser(userId, roleId, isPrimary),
    "Role assigned successfully",
  );
}

export function useRemoveRoleFromUser() {
  return useRoleAssignmentMutation(
    ({ userId, roleId }: { userId: string; roleId: string }) =>
      rolesService.removeRoleFromUser(userId, roleId),
    "Role removed successfully",
  );
}

/** Marks the role primary in user_roles_mapping (assigning it if needed); others become non-primary. */
export function useSetPrimaryRole() {
  return useRoleAssignmentMutation(
    ({ userId, roleId }: { userId: string; roleId: string }) =>
      rolesService.setPrimaryRole(userId, roleId),
    "Primary role updated",
  );
}
