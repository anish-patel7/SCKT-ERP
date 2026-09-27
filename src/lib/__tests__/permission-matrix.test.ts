import { describe, expect, it } from "vitest";
import {
  buildPermissionMatrix,
  cellAriaLabel,
  countGranted,
  diffGrants,
  groupPermissionIds,
  withIds,
  type MatrixResource,
  type PermissionMatrixModel,
} from "@/lib/permission-matrix";
import { CATALOG, idOf, toCatalog } from "./permission-catalog.fixture";

function resource(model: PermissionMatrixModel, module: string): MatrixResource {
  const found = model.groups.flatMap((g) => g.resources).find((r) => r.module === module);
  if (!found) throw new Error(`resource ${module} not in matrix`);
  return found;
}

describe("buildPermissionMatrix — grouping and order", () => {
  const model = buildPermissionMatrix(CATALOG);

  it("orders modules by application navigation order", () => {
    expect(model.groups.map((g) => g.group)).toEqual([
      "Masters",
      "Design",
      "Costing",
      "Inventory",
      "Production",
      "Quality",
      "Sales",
      "Reports",
      "System",
    ]);
  });

  it("orders resources logically, not alphabetically", () => {
    const masters = model.groups.find((g) => g.group === "Masters");
    const system = model.groups.find((g) => g.group === "System");
    expect(masters?.resources.map((r) => r.label)).toEqual(["Yarn", "Party", "Other Masters"]);
    expect(system?.resources.map((r) => r.module)).toEqual([
      "user_management",
      "role_management",
      "audit",
    ]);
  });

  it("uses one global set of standard action columns in VIEW..APPROVE order", () => {
    expect(model.columns).toEqual(["read", "create", "update", "delete", "approve"]);
    expect(model.hasSpecial).toBe(true);
  });
});

describe("buildPermissionMatrix — System permission granularity", () => {
  const model = buildPermissionMatrix(CATALOG);

  it("Users exposes VIEW / CREATE / EDIT / APPROVE, no DELETE, plus role assignment", () => {
    const users = resource(model, "user_management");
    expect([...users.standard.keys()]).toEqual(["read", "create", "update", "approve"]);
    expect(users.standard.has("delete")).toBe(false);
    expect(users.special.map((c) => [c.action, c.label, c.legacy])).toEqual([
      ["assign_role", "ASSIGN ROLES", false],
      ["write", "LEGACY WRITE", true],
    ]);
  });

  it("Roles exposes VIEW / CREATE / EDIT plus permission assignment", () => {
    const roles = resource(model, "role_management");
    expect([...roles.standard.keys()]).toEqual(["read", "create", "update"]);
    expect(roles.special.map((c) => c.action)).toEqual(["assign_permissions"]);
  });

  it("Audit History stays VIEW-only", () => {
    const audit = resource(model, "audit");
    expect([...audit.standard.keys()]).toEqual(["read"]);
    expect(audit.special).toEqual([]);
  });

  it("a module-level write without granular actions is not labelled legacy", () => {
    const inventory = resource(model, "inventory");
    expect(inventory.special).toHaveLength(1);
    expect(inventory.special[0]?.legacy).toBe(false);
    expect(inventory.special[0]?.label).toBe("WRITE (ALL CHANGES)");
  });
});

describe("buildPermissionMatrix — legacy duplicates and future permissions", () => {
  it("hides the superseded yarn_master duplicate unless requested", () => {
    const hidden = buildPermissionMatrix(CATALOG);
    expect(hidden.hiddenDeprecated.map((r) => r.module)).toEqual(["yarn_master"]);
    expect(hidden.groups.flatMap((g) => g.resources).some((r) => r.module === "yarn_master")).toBe(
      false,
    );

    const shown = buildPermissionMatrix(CATALOG, { includeDeprecated: true });
    expect(shown.hiddenDeprecated).toEqual([]);
    expect(resource(shown, "yarn_master").replacedBy).toBe("masters.yarn");
  });

  it("does not render an action column no resource uses", () => {
    const model = buildPermissionMatrix(toCatalog(["audit:read", "sales:read", "sales:create"]));
    expect(model.columns).toEqual(["read", "create"]);
    expect(model.hasSpecial).toBe(false);
  });

  it("shows a newly added permission without code changes", () => {
    const model = buildPermissionMatrix(toCatalog(["dispatch:read", "dispatch:cancel"]));
    const dispatch = resource(model, "dispatch");
    expect(dispatch.group).toBe("Dispatch");
    expect(dispatch.special.map((c) => c.label)).toEqual(["CANCEL"]);
  });

  it("builds accessible checkbox names from resource and action", () => {
    const model = buildPermissionMatrix(CATALOG);
    const sales = resource(model, "sales");
    const create = sales.standard.get("create");
    expect(create && cellAriaLabel(sales, create)).toBe("Sales — Create");
    const users = resource(model, "user_management");
    expect(users.special[0] && cellAriaLabel(users, users.special[0])).toBe("Users — Assign roles");
  });
});

describe("draft helpers", () => {
  it("groupPermissionIds selects a module's VIEW or all permissions", () => {
    const model = buildPermissionMatrix(CATALOG);
    const system = model.groups.find((g) => g.group === "System");
    if (!system) throw new Error("System group missing");
    expect(groupPermissionIds(system, "read").sort()).toEqual(
      [idOf("user_management:read"), idOf("role_management:read"), idOf("audit:read")].sort(),
    );
    expect(groupPermissionIds(system)).toHaveLength(11);
  });

  it("withIds / diffGrants / countGranted track unsaved changes", () => {
    const saved = new Set([idOf("sales:read")]);
    const draft = withIds(
      withIds(saved, [idOf("sales:create")], true),
      [idOf("sales:read")],
      false,
    );
    expect(saved.has(idOf("sales:read"))).toBe(true); // saved set is not mutated
    expect(diffGrants(saved, draft)).toEqual({
      added: [idOf("sales:create")],
      removed: [idOf("sales:read")],
    });
    expect(diffGrants(saved, new Set(saved))).toEqual({ added: [], removed: [] });
    expect(countGranted(CATALOG, new Set([...draft, "not-in-catalog"]))).toBe(1);
  });
});
