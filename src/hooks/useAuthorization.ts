import { useAuth } from "@/hooks/useAuth";
import {
  useCurrentUserRoles,
  useCurrentUserHasRole,
  useCurrentUserHasPermission,
} from "@/hooks/useRoles";
import {
  hasRole,
  hasAnyRole,
  isAdmin,
  isManagerOrAbove,
  canCreateEntries,
  hasWriteAccess,
  getHighestRole,
  canPerformAction,
} from "@/lib/authorization";
import { AppRole } from "@/lib/validators/auth";

/**
 * Combined authorization hook providing all permission checks
 * Returns loading state, computed permissions, and role data
 */
export function useAuthorization() {
  const { user, loading: authLoading } = useAuth();
  const { data: userRoles, isLoading: rolesLoading } = useCurrentUserRoles();

  const isLoading = authLoading || rolesLoading;
  const roles = userRoles?.map((r) => r.role_code).filter((code) =>
    ["admin", "manager", "operator", "viewer", "costing"].includes(code.toLowerCase())
  ).map((code) => code.toLowerCase() as AppRole) || [];
  const isAuthenticated = !!user && !authLoading;

  return {
    // Auth state
    isAuthenticated,
    isLoading,
    user,

    // Role data
    roles,
    highestRole: getHighestRole(roles),
    userRoles,

    // Role checks
    hasRole: (role: AppRole) => hasRole(roles, role),
    hasAnyRole: (requiredRoles: AppRole[]) => hasAnyRole(roles, requiredRoles),
    isAdmin: () => isAdmin(roles),
    isManagerOrAbove: () => isManagerOrAbove(roles),
    canCreateEntries: () => canCreateEntries(roles),
    hasWriteAccess: () => hasWriteAccess(roles),

    // Module-action checks
    canPerformAction: (
      module: string,
      action: "read" | "create" | "update" | "delete" | "approve" | "write",
    ) => canPerformAction(module as any, action, roles as AppRole[]),

    // Specific module checks
    canReadYarnMasters: () => canPerformAction("yarnMaster", "read", roles as AppRole[]),
    canCreateYarnMasters: () => canPerformAction("yarnMaster", "create", roles as AppRole[]),
    canUpdateYarnMasters: () => canPerformAction("yarnMaster", "update", roles as AppRole[]),
    canDeleteYarnMasters: () => canPerformAction("yarnMaster", "delete", roles as AppRole[]),

    canReadCostSheets: () => canPerformAction("costSheet", "read", roles as AppRole[]),
    canCreateCostSheets: () => canPerformAction("costSheet", "create", roles as AppRole[]),
    canUpdateCostSheets: () => canPerformAction("costSheet", "update", roles as AppRole[]),
    canApproveCostSheets: () => canPerformAction("costSheet", "approve", roles as AppRole[]),
    canDeleteCostSheets: () => canPerformAction("costSheet", "delete", roles as AppRole[]),

    canReadInventory: () => canPerformAction("inventory", "read", roles as AppRole[]),
    canWriteInventory: () => canPerformAction("inventory", "write", roles as AppRole[]),

    canReadProduction: () => canPerformAction("production", "read", roles as AppRole[]),
    canCreateProduction: () => canPerformAction("production", "create", roles as AppRole[]),
    canUpdateProduction: () => canPerformAction("production", "update", roles as AppRole[]),
    canApproveProduction: () => canPerformAction("production", "approve", roles as AppRole[]),

    canReadQuality: () => canPerformAction("quality", "read", roles as AppRole[]),
    canWriteQuality: () => canPerformAction("quality", "write", roles as AppRole[]),

    canReadSales: () => canPerformAction("sales", "read", roles as AppRole[]),
    canCreateSales: () => canPerformAction("sales", "create", roles as AppRole[]),
    canUpdateSales: () => canPerformAction("sales", "update", roles as AppRole[]),
    canApproveSales: () => canPerformAction("sales", "approve", roles as AppRole[]),

    canReadReports: () => canPerformAction("reports", "read", roles as AppRole[]),

    canManageUsers: () => canPerformAction("userManagement", "read", roles as AppRole[]),

    canReadAudit: () => canPerformAction("audit", "read", roles as AppRole[]),
  };
}

/**
 * Simpler hook that returns just boolean for a specific role
 */
export function useIsRole(role: AppRole) {
  const { data } = useCurrentUserHasRole(role);
  return data ?? false;
}

/**
 * Simpler hook that returns just boolean for a specific permission
 */
export function useCanPerform(permissionCode: string) {
  const { data } = useCurrentUserHasPermission(permissionCode);
  return data ?? false;
}

/**
 * Hook to check if user is admin
 */
export function useIsAdmin() {
  return useIsRole(AppRole.Admin);
}

/**
 * Hook to check if user is manager or above
 */
export function useIsManagerOrAbove() {
  const { data: userRoles, isLoading } = useCurrentUserRoles();
  const roles = userRoles?.map((r) => r.role_code).filter((code) =>
    ["admin", "manager", "operator", "viewer", "costing"].includes(code.toLowerCase())
  ).map((code) => code.toLowerCase() as AppRole) || [];
  return { isManagerOrAbove: isManagerOrAbove(roles), isLoading };
}

/**
 * Hook to check if user can create entries (operator or above)
 */
export function useCanCreateEntries() {
  const { data: userRoles, isLoading } = useCurrentUserRoles();
  const roles = userRoles?.map((r) => r.role_code).filter((code) =>
    ["admin", "manager", "operator", "viewer", "costing"].includes(code.toLowerCase())
  ).map((code) => code.toLowerCase() as AppRole) || [];
  return { canCreate: canCreateEntries(roles), isLoading };
}
