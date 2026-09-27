/**
 * Permission Matrix model: turns the backend permission catalog (public.permissions)
 * into module → resource → action rows. The catalog's own `module` and `action`
 * columns are the source of truth, so permissions added by a future migration appear
 * here without any change to the matrix page. Presentation only; never authorizes.
 */
import {
  STANDARD_ACTIONS,
  actionLabel,
  actionSortIndex,
  groupSortIndex,
  isStandardAction,
  moduleLabel,
  moduleSortIndex,
} from "@/lib/access-control";

export type CatalogPermission = {
  id: string;
  permission_code: string;
  permission_name: string;
  description: string | null;
  module: string;
  action: string;
};

export type StandardAction = (typeof STANDARD_ACTIONS)[number];

export type MatrixCell = {
  permission: CatalogPermission;
  action: string;
  label: string;
  /** A `write` aggregate on a resource that also has granular actions. */
  legacy: boolean;
};

export type MatrixResource = {
  module: string;
  label: string;
  group: string;
  /** Module superseded by another; hidden unless legacy rows are shown. */
  replacedBy: string | null;
  standard: ReadonlyMap<string, MatrixCell>;
  /** Non-CRUD actions (role assignment, legacy write, ...), in ACTION_ORDER. */
  special: MatrixCell[];
  cells: MatrixCell[];
};

export type MatrixGroup = { group: string; resources: MatrixResource[] };

export type PermissionMatrixModel = {
  /** Standard action columns used by at least one visible resource, in standard order. */
  columns: StandardAction[];
  /** True when any visible resource has a non-standard action. */
  hasSpecial: boolean;
  groups: MatrixGroup[];
  /** Deprecated resources left out of `groups` (when includeDeprecated is false). */
  hiddenDeprecated: MatrixResource[];
};

function cellLabel(action: string, legacy: boolean): string {
  if (action === "write") return legacy ? "LEGACY WRITE" : "WRITE (ALL CHANGES)";
  return actionLabel(action);
}

function buildResource(module: string, perms: CatalogPermission[]): MatrixResource {
  const { group, resource, replacedBy } = moduleLabel(module);
  // `write` is a legacy aggregate once the resource also defines granular actions.
  const hasGranular = perms.some((p) => p.action !== "read" && p.action !== "write");
  const cells = [...perms]
    .sort(
      (a, b) =>
        actionSortIndex(a.action) - actionSortIndex(b.action) || a.action.localeCompare(b.action),
    )
    .map((permission): MatrixCell => {
      const legacy = permission.action === "write" && hasGranular;
      return {
        permission,
        action: permission.action,
        label: cellLabel(permission.action, legacy),
        legacy,
      };
    });
  return {
    module,
    label: resource,
    group,
    replacedBy: replacedBy ?? null,
    standard: new Map(cells.filter((c) => isStandardAction(c.action)).map((c) => [c.action, c])),
    special: cells.filter((c) => !isStandardAction(c.action)),
    cells,
  };
}

export function buildPermissionMatrix(
  permissions: readonly CatalogPermission[],
  options: { includeDeprecated?: boolean } = {},
): PermissionMatrixModel {
  const byModule = new Map<string, CatalogPermission[]>();
  for (const p of permissions) {
    const list = byModule.get(p.module) ?? [];
    list.push(p);
    byModule.set(p.module, list);
  }

  const resources = [...byModule.entries()].map(([module, perms]) => buildResource(module, perms));
  const hiddenDeprecated = options.includeDeprecated ? [] : resources.filter((r) => r.replacedBy);
  const visible = resources.filter((r) => options.includeDeprecated || !r.replacedBy);

  const groups = new Map<string, MatrixResource[]>();
  for (const r of visible) {
    const list = groups.get(r.group) ?? [];
    list.push(r);
    groups.set(r.group, list);
  }

  const used = new Set(visible.flatMap((r) => [...r.standard.keys()]));
  return {
    columns: STANDARD_ACTIONS.filter((a) => used.has(a)),
    hasSpecial: visible.some((r) => r.special.length > 0),
    hiddenDeprecated,
    groups: [...groups.entries()]
      .sort(([a], [b]) => groupSortIndex(a) - groupSortIndex(b) || a.localeCompare(b))
      .map(([group, list]) => ({
        group,
        resources: list.sort(
          (a, b) =>
            moduleSortIndex(a.module) - moduleSortIndex(b.module) || a.label.localeCompare(b.label),
        ),
      })),
  };
}

/** Accessible name for one checkbox, e.g. "Sales — Create". */
export function cellAriaLabel(resource: MatrixResource, cell: MatrixCell): string {
  const words = cell.label.toLowerCase();
  return `${resource.label} — ${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

/** Permission ids in a group, optionally limited to one action. */
export function groupPermissionIds(group: MatrixGroup, action?: string): string[] {
  return group.resources.flatMap((r) =>
    r.cells.filter((c) => action === undefined || c.action === action).map((c) => c.permission.id),
  );
}

export function withIds(
  current: ReadonlySet<string>,
  ids: readonly string[],
  granted: boolean,
): Set<string> {
  const next = new Set(current);
  for (const id of ids) {
    if (granted) next.add(id);
    else next.delete(id);
  }
  return next;
}

export type GrantDiff = { added: string[]; removed: string[] };

export function diffGrants(saved: ReadonlySet<string>, draft: ReadonlySet<string>): GrantDiff {
  return {
    added: [...draft].filter((id) => !saved.has(id)),
    removed: [...saved].filter((id) => !draft.has(id)),
  };
}

/** Number of catalog permissions granted by `ids` (ignores grants of inactive permissions). */
export function countGranted(
  permissions: readonly CatalogPermission[],
  ids: ReadonlySet<string>,
): number {
  return permissions.filter((p) => ids.has(p.id)).length;
}
