/**
 * Route → permission requirements and display labels for the permission catalog.
 * Permission definitions live in public.permissions; this file only references codes.
 */

export type AccessRequirement = { anyOf: readonly string[] };

/**
 * System administration permission codes (seeded by migration 007A).
 * user_management:write is a legacy aggregate: it no longer authorizes user or role
 * administration in RLS, and only gates the screens listed in ROUTE_RULES below.
 */
export const SYSTEM_PERMISSIONS = {
  usersRead: "user_management:read",
  usersCreate: "user_management:create",
  usersUpdate: "user_management:update",
  usersApprove: "user_management:approve",
  usersAssignRole: "user_management:assign_role",
  rolesRead: "role_management:read",
  rolesCreate: "role_management:create",
  rolesUpdate: "role_management:update",
  rolesAssignPermissions: "role_management:assign_permissions",
  auditRead: "audit:read",
  legacyWrite: "user_management:write",
} as const;

const P = SYSTEM_PERMISSIONS;

type RouteRule = { path: string; exact?: boolean } & AccessRequirement;

const ROUTE_RULES: readonly RouteRule[] = [
  { path: "/cost-sheets/new", exact: true, anyOf: ["cost_sheet:create"] },
  { path: "/cost-sheets", anyOf: ["cost_sheet:read"] },
  { path: "/approvals", anyOf: ["cost_sheet:approve"] },
  { path: "/designs", anyOf: ["design:read"] },
  { path: "/gallery", anyOf: ["design:read"] },
  { path: "/feeders", anyOf: ["design:read"] },
  { path: "/production", anyOf: ["production:read"] },
  { path: "/inventory", anyOf: ["inventory:read"] },
  { path: "/sales", anyOf: ["sales:read"] },
  { path: "/quality", anyOf: ["quality:read"] },
  { path: "/masters/material", anyOf: ["masters.yarn:read"] },
  { path: "/masters/party", anyOf: ["masters.party:read"] },
  { path: "/masters", anyOf: ["masters.generic:read"] },
  { path: "/reports", anyOf: ["reports:read"] },
  { path: "/analytics", anyOf: ["reports:read"] },
  {
    path: "/system",
    exact: true,
    anyOf: [P.usersRead, P.rolesRead, P.auditRead],
  },
  { path: "/system/users", anyOf: [P.usersRead] },
  { path: "/system/roles", anyOf: [P.rolesRead] },
  { path: "/system/permission-matrix", anyOf: [P.rolesRead] },
  { path: "/system/settings", anyOf: [P.usersRead] },
  { path: "/system/audit", anyOf: [P.auditRead] },
  { path: "/system/backup", anyOf: [P.legacyWrite] },
  { path: "/system/whatsapp", anyOf: [P.legacyWrite] },
  { path: "/admin/migration", anyOf: [P.legacyWrite] },
];

function normalize(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/** Requirement for a path, or null when any authenticated user may open it. */
export function accessRequirementFor(
  pathname: string,
): AccessRequirement | null {
  const path = normalize(pathname);
  let best: RouteRule | null = null;
  for (const rule of ROUTE_RULES) {
    const matches = rule.exact
      ? path === rule.path
      : path === rule.path || path.startsWith(rule.path + "/");
    if (matches && (!best || rule.path.length > best.path.length)) best = rule;
  }
  return best ? { anyOf: best.anyOf } : null;
}

// ---------------------------------------------------------------------------
// Display grouping for the permission catalog (presentation only)
// ---------------------------------------------------------------------------

export const MODULE_GROUP_ORDER = [
  "Dashboard",
  "Masters",
  "Design",
  "Costing",
  "Inventory",
  "Production",
  "Quality",
  "Sales",
  "Reservations",
  "Dispatch",
  "Invoices",
  "Payments",
  "Reports",
  "System",
] as const;

type ModuleLabel = { group: string; resource: string; replacedBy?: string };

/** Known resources in business / navigation order within each group. */
const MODULE_LABELS: Record<string, ModuleLabel> = {
  "masters.yarn": { group: "Masters", resource: "Yarn" },
  "masters.party": { group: "Masters", resource: "Party" },
  "masters.generic": { group: "Masters", resource: "Other Masters" },
  // Not referenced by any route, component or RLS policy; superseded by masters.yarn.
  yarn_master: {
    group: "Masters",
    resource: "Yarn Master (legacy)",
    replacedBy: "masters.yarn",
  },
  design: { group: "Design", resource: "Designs" },
  cost_sheet: { group: "Costing", resource: "Cost Sheets" },
  inventory: { group: "Inventory", resource: "Stock" },
  production: { group: "Production", resource: "Production" },
  quality: { group: "Quality", resource: "Quality" },
  sales: { group: "Sales", resource: "Sales" },
  reports: { group: "Reports", resource: "Reports & Analytics" },
  user_management: { group: "System", resource: "Users" },
  role_management: { group: "System", resource: "Roles / Access Groups" },
  audit: { group: "System", resource: "Audit History" },
};

const MODULE_ORDER = Object.keys(MODULE_LABELS);

function titleCase(value: string): string {
  return value
    .split(/[._\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function moduleLabel(module: string): ModuleLabel {
  const known = MODULE_LABELS[module];
  if (known) return known;
  const [head = module, ...rest] = module.split(".");
  return {
    group: titleCase(head),
    resource: rest.length ? titleCase(rest.join(".")) : titleCase(head),
  };
}

/** Logical order of a resource; unknown (future) resources sort after known ones. */
export function moduleSortIndex(module: string): number {
  const idx = MODULE_ORDER.indexOf(module);
  return idx === -1 ? MODULE_ORDER.length : idx;
}

export function groupSortIndex(group: string): number {
  const idx = (MODULE_GROUP_ORDER as readonly string[]).indexOf(group);
  return idx === -1 ? MODULE_GROUP_ORDER.length : idx;
}

const ACTION_LABELS: Record<string, string> = {
  read: "VIEW",
  create: "CREATE",
  update: "EDIT",
  delete: "DELETE",
  approve: "APPROVE",
  write: "WRITE",
  assign_role: "ASSIGN ROLES",
  assign_permissions: "ASSIGN PERMISSIONS",
};

/** Standard CRUD + approval actions, each rendered as its own matrix column. */
export const STANDARD_ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "approve",
] as const;

export const ACTION_ORDER: readonly string[] = [
  ...STANDARD_ACTIONS,
  "assign_role",
  "assign_permissions",
  "write",
];

export function isStandardAction(action: string): boolean {
  return (STANDARD_ACTIONS as readonly string[]).includes(action);
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ").toUpperCase();
}

export function actionSortIndex(action: string): number {
  const idx = ACTION_ORDER.indexOf(action);
  return idx === -1 ? ACTION_ORDER.length : idx;
}
