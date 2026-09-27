import type { CatalogPermission } from "@/lib/permission-matrix";

/** Permission codes of the final catalog after migration 007A (see SCKT_FRESH_PROJECT.sql). */
export const CATALOG_CODES = [
  "yarn_master:read",
  "yarn_master:create",
  "yarn_master:update",
  "yarn_master:delete",
  "cost_sheet:read",
  "cost_sheet:create",
  "cost_sheet:update",
  "cost_sheet:approve",
  "inventory:read",
  "inventory:write",
  "production:read",
  "production:create",
  "production:update",
  "quality:read",
  "quality:write",
  "sales:read",
  "sales:create",
  "sales:update",
  "user_management:read",
  "user_management:write",
  "reports:read",
  "audit:read",
  "masters.yarn:read",
  "masters.yarn:create",
  "masters.yarn:update",
  "masters.yarn:delete",
  "masters.generic:read",
  "masters.generic:create",
  "masters.generic:update",
  "masters.generic:delete",
  "masters.party:read",
  "masters.party:create",
  "masters.party:update",
  "masters.party:delete",
  "design:read",
  "design:create",
  "design:update",
  "design:delete",
  "user_management:create",
  "user_management:update",
  "user_management:approve",
  "user_management:assign_role",
  "role_management:read",
  "role_management:create",
  "role_management:update",
  "role_management:assign_permissions",
] as const;

export function toCatalog(codes: readonly string[]): CatalogPermission[] {
  return codes.map((code, i) => {
    const [module = code, action = ""] = code.split(":");
    return {
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      permission_code: code,
      permission_name: code,
      description: null,
      module,
      action,
    };
  });
}

export const CATALOG = toCatalog(CATALOG_CODES);

export function idOf(code: string): string {
  const found = CATALOG.find((p) => p.permission_code === code);
  if (!found) throw new Error(`unknown permission ${code}`);
  return found.id;
}
