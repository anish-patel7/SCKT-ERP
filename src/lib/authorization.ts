import { AppRole } from "@/lib/validators/auth";

/**
 * Authorization utility functions for role and permission checks
 * Used throughout the application for access control
 */

/**
 * Check if user has required role
 * @param userRoles Array of user's roles
 * @param requiredRole Single role to check for
 * @returns true if user has the role
 */
export function hasRole(userRoles: AppRole[] | undefined, requiredRole: AppRole): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  return userRoles.includes(requiredRole);
}

/**
 * Check if user has any of the required roles
 * @param userRoles Array of user's roles
 * @param requiredRoles Array of roles, any one grants access
 * @returns true if user has at least one of the roles
 */
export function hasAnyRole(userRoles: AppRole[] | undefined, requiredRoles: AppRole[]): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  return requiredRoles.some((role) => userRoles.includes(role));
}

/**
 * Check if user has all of the required roles
 * @param userRoles Array of user's roles
 * @param requiredRoles Array of roles, all must be present
 * @returns true if user has all of the roles
 */
export function hasAllRoles(userRoles: AppRole[] | undefined, requiredRoles: AppRole[]): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  return requiredRoles.every((role) => userRoles.includes(role));
}

/**
 * Check if user is admin
 * @param userRoles Array of user's roles
 * @returns true if user has admin role
 */
export function isAdmin(userRoles: AppRole[] | undefined): boolean {
  return hasRole(userRoles, AppRole.Admin);
}

/**
 * Check if user is manager or admin
 * @param userRoles Array of user's roles
 * @returns true if user is manager or admin
 */
export function isManagerOrAbove(userRoles: AppRole[] | undefined): boolean {
  return hasAnyRole(userRoles, [AppRole.Admin, AppRole.Manager]);
}

/**
 * Check if user can perform data entry (operator or above)
 * @param userRoles Array of user's roles
 * @returns true if user is operator, manager, or admin
 */
export function canCreateEntries(userRoles: AppRole[] | undefined): boolean {
  return hasAnyRole(userRoles, [AppRole.Admin, AppRole.Manager, AppRole.Operator]);
}

/**
 * Check if user has write permissions (not just viewer)
 * @param userRoles Array of user's roles
 * @returns true if user is not just a viewer
 */
export function hasWriteAccess(userRoles: AppRole[] | undefined): boolean {
  return canCreateEntries(userRoles);
}

/**
 * Get role hierarchy level (for UI ordering/comparison)
 * Higher number = more permissions
 * @param role User role
 * @returns Numeric hierarchy level
 */
export function getRoleLevel(role: AppRole): number {
  const levels: Record<AppRole, number> = {
    [AppRole.Admin]: 4,
    [AppRole.Manager]: 3,
    [AppRole.Operator]: 2,
    [AppRole.Viewer]: 1,
  };
  return levels[role];
}

/**
 * Check if user1's role is higher than or equal to user2's role
 * @param userRole User's role
 * @param targetRole Target role to compare
 * @returns true if user has higher or equal role level
 */
export function hasHigherOrEqualRole(userRole: AppRole, targetRole: AppRole): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(targetRole);
}

/**
 * Get user's highest role (for role-based display)
 * @param userRoles Array of user's roles
 * @returns Highest role or undefined if no roles
 */
export function getHighestRole(userRoles: AppRole[] | undefined): AppRole | undefined {
  if (!userRoles || userRoles.length === 0) return undefined;
  return userRoles.reduce((highest, current) => {
    return getRoleLevel(current) > getRoleLevel(highest) ? current : highest;
  });
}

/**
 * Role hierarchy: admin > manager > operator > viewer
 * Check if user can perform module-specific action
 */
export const ModulePermissions: Record<string, Record<string, AppRole[]>> = {
  // Yarn Masters
  yarnMaster: {
    read: [AppRole.Admin, AppRole.Manager, AppRole.Operator, AppRole.Viewer],
    create: [AppRole.Admin, AppRole.Manager, AppRole.Operator],
    update: [AppRole.Admin, AppRole.Manager, AppRole.Operator],
    delete: [AppRole.Admin],
  },
  // Cost Sheets
  costSheet: {
    read: [AppRole.Admin, AppRole.Manager, AppRole.Operator, AppRole.Viewer],
    create: [AppRole.Admin, AppRole.Manager, AppRole.Operator],
    update: [AppRole.Admin, AppRole.Manager, AppRole.Operator],
    approve: [AppRole.Admin, AppRole.Manager],
    delete: [AppRole.Admin],
  },
  // Inventory
  inventory: {
    read: [AppRole.Admin, AppRole.Manager, AppRole.Operator, AppRole.Viewer],
    create: [AppRole.Admin, AppRole.Manager, AppRole.Operator],
    write: [AppRole.Admin, AppRole.Manager, AppRole.Operator],
    delete: [AppRole.Admin],
  },
  // Production
  production: {
    read: [AppRole.Admin, AppRole.Manager, AppRole.Operator, AppRole.Viewer],
    create: [AppRole.Admin, AppRole.Manager, AppRole.Operator],
    update: [AppRole.Admin, AppRole.Manager, AppRole.Operator],
    approve: [AppRole.Admin, AppRole.Manager],
    delete: [AppRole.Admin],
  },
  // Quality
  quality: {
    read: [AppRole.Admin, AppRole.Manager, AppRole.Operator, AppRole.Viewer],
    write: [AppRole.Admin, AppRole.Manager, AppRole.Operator],
    approve: [AppRole.Admin, AppRole.Manager],
  },
  // Sales
  sales: {
    read: [AppRole.Admin, AppRole.Manager, AppRole.Operator, AppRole.Viewer],
    create: [AppRole.Admin, AppRole.Manager, AppRole.Operator],
    update: [AppRole.Admin, AppRole.Manager, AppRole.Operator],
    approve: [AppRole.Admin, AppRole.Manager],
    delete: [AppRole.Admin],
  },
  // Reports
  reports: {
    read: [AppRole.Admin, AppRole.Manager, AppRole.Operator, AppRole.Viewer],
  },
  // User Management
  userManagement: {
    read: [AppRole.Admin],
    create: [AppRole.Admin],
    update: [AppRole.Admin],
    delete: [AppRole.Admin],
  },
  // Audit
  audit: {
    read: [AppRole.Admin],
  },
};

/**
 * Check if user can perform a module action
 * @param module Module name (key from ModulePermissions)
 * @param action Action name (read, create, update, delete, approve)
 * @param userRoles User's roles
 * @returns true if user can perform the action
 */
export function canPerformAction(
  module: keyof typeof ModulePermissions,
  action: "read" | "create" | "update" | "delete" | "approve" | "write",
  userRoles: AppRole[] | undefined,
): boolean {
  if (!userRoles || userRoles.length === 0) return false;

  const modulePerms = ModulePermissions[module] as Record<string, AppRole[]>;
  const requiredRoles = modulePerms[action];

  if (!requiredRoles) return false;

  return hasAnyRole(userRoles, requiredRoles as AppRole[]);
}

/**
 * Get a user-friendly role display name
 * @param role Role to display
 * @returns Display name for UI
 */
export function getRoleDisplayName(role: AppRole): string {
  const names: Record<AppRole, string> = {
    [AppRole.Admin]: "Administrator",
    [AppRole.Manager]: "Manager",
    [AppRole.Operator]: "Operator",
    [AppRole.Viewer]: "Viewer",
  };
  return names[role];
}

/**
 * Get a user-friendly role description
 * @param role Role to describe
 * @returns Description for UI
 */
export function getRoleDescription(role: AppRole): string {
  const descriptions: Record<AppRole, string> = {
    [AppRole.Admin]: "Full system access and user management",
    [AppRole.Manager]: "Department operations, approvals, and reporting",
    [AppRole.Operator]: "Day-to-day data entry and operations",
    [AppRole.Viewer]: "Read-only access to data",
  };
  return descriptions[role];
}
