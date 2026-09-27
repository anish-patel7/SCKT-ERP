import { describe, expect, it } from "vitest";
import { SYSTEM_PERMISSIONS, accessRequirementFor } from "@/lib/access-control";

describe("System route guards", () => {
  it("opens administration screens with read permissions only", () => {
    expect(accessRequirementFor("/system/users")?.anyOf).toEqual(["user_management:read"]);
    expect(accessRequirementFor("/system/roles")?.anyOf).toEqual(["role_management:read"]);
    expect(accessRequirementFor("/system/permission-matrix")?.anyOf).toEqual([
      "role_management:read",
    ]);
    expect(accessRequirementFor("/system/audit")?.anyOf).toEqual(["audit:read"]);
  });

  it("shows the System landing page to any System reader", () => {
    expect(accessRequirementFor("/system")?.anyOf).toEqual([
      "user_management:read",
      "role_management:read",
      "audit:read",
    ]);
  });

  it("no longer gates user or role administration on the legacy write permission", () => {
    for (const path of ["/system/users", "/system/roles", "/system/permission-matrix"]) {
      expect(accessRequirementFor(path)?.anyOf).not.toContain(SYSTEM_PERMISSIONS.legacyWrite);
    }
  });

  it("uses the granular codes seeded by migration 007A", () => {
    expect(SYSTEM_PERMISSIONS).toMatchObject({
      usersCreate: "user_management:create",
      usersUpdate: "user_management:update",
      usersApprove: "user_management:approve",
      usersAssignRole: "user_management:assign_role",
      rolesCreate: "role_management:create",
      rolesUpdate: "role_management:update",
      rolesAssignPermissions: "role_management:assign_permissions",
    });
  });
});
