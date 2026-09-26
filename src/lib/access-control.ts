/**
 * Route → permission requirements and display labels for the permission catalog.
 * Permission definitions live in public.permissions; this file only references codes.
 */

export type AccessRequirement = { anyOf: readonly string[] };

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
  { path: "/system", exact: true, anyOf: ["user_management:read", "audit:read"] },
  { path: "/system/users", anyOf: ["user_management:read"] },
  { path: "/system/roles", anyOf: ["user_management:read"] },
  { path: "/system/permission-matrix", anyOf: ["user_management:read"] },
  { path: "/system/settings", anyOf: ["user_management:read"] },
  { path: "/system/audit", anyOf: ["audit:read"] },
  { path: "/system/backup", anyOf: ["user_management:write"] },
  { path: "/system/whatsapp", anyOf: ["user_management:write"] },
  { path: "/admin/migration", anyOf: ["user_management:write"] },
];

function normalize(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/** Requirement for a path, or null when any authenticated user may open it. */
export function accessRequirementFor(pathname: string): AccessRequirement | null {
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

const MODULE_LABELS: Record<string, { group: string; resource: string }> = {
  "masters.yarn": { group: "Masters", resource: "Yarn" },
  "masters.party": { group: "Masters", resource: "Party" },
  "masters.generic": { group: "Masters", resource: "Other Masters" },
  yarn_master: { group: "Masters", resource: "Yarn Master (legacy duplicate)" },
  cost_sheet: { group: "Costing", resource: "Cost Sheets" },
  design: { group: "Design", resource: "Designs" },
  inventory: { group: "Inventory", resource: "Stock" },
  production: { group: "Production", resource: "Production" },
  quality: { group: "Quality", resource: "Quality" },
  sales: { group: "Sales", resource: "Sales" },
  reports: { group: "Reports", resource: "Reports & Analytics" },
  user_management: { group: "System", resource: "Users, Roles & Permissions" },
  audit: { group: "System", resource: "Audit History" },
};

function titleCase(value: string): string {
  return value
    .split(/[._\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function moduleLabel(module: string): { group: string; resource: string } {
  const known = MODULE_LABELS[module];
  if (known) return known;
  const [head = module, ...rest] = module.split(".");
  return {
    group: titleCase(head),
    resource: rest.length ? titleCase(rest.join(".")) : titleCase(head),
  };
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
};

export const ACTION_ORDER = ["read", "create", "update", "delete", "approve", "write"];

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.toUpperCase();
}

export function actionSortIndex(action: string): number {
  const idx = ACTION_ORDER.indexOf(action);
  return idx === -1 ? ACTION_ORDER.length : idx;
}
